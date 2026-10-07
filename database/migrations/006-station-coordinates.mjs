// Add nullable WGS84 coordinates and fill only missing demo station locations.
// Run on an existing application database; never replay the full seed.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'backend/package.json'));
const mysql = require('mysql2/promise');
const coordinates = JSON.parse(await readFile(resolve(root, 'database/hanoi-station-coordinates.json'), 'utf8'));
process.loadEnvFile(resolve(root, '.env'));
const db = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
});
const hash = (rows) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');

try {
  const [tables] = await db.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const names = tables.map((table) => Object.values(table)[0]);
  if (!names.includes('stations') || !names.includes('route_stops')) {
    throw new Error(`Database ${process.env.DB_NAME} is not the GoBus application schema`);
  }
  const snapshot = {};
  for (const name of names) {
    const [columns] = await db.query('SHOW COLUMNS FROM ??', [name]);
    const [schema] = await db.query('SHOW CREATE TABLE ??', [name]);
    const [rows] = await db.query('SELECT * FROM ?? ORDER BY id', [name]);
    snapshot[name] = {
      columns: columns.map((column) => column.Field),
      schema: schema[0]['Create Table'],
      rows,
    };
  }
  const backupDir = resolve(root, '.local/backups');
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = resolve(backupDir, `station-coordinates-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(backupPath, JSON.stringify({ database: process.env.DB_NAME, snapshot }, null, 2), { mode: 0o600 });
  console.log(`Backup saved: ${backupPath}`);

  const originalColumns = snapshot.stations.columns;
  for (const column of ['latitude', 'longitude']) {
    if (!originalColumns.includes(column)) {
      await db.query(`ALTER TABLE stations ADD COLUMN ${column} DECIMAL(10,7) NULL`);
      console.log(`Added stations.${column}`);
    }
  }
  const [invalid] = await db.query(`SELECT code FROM stations WHERE
    (latitude IS NULL AND longitude IS NOT NULL) OR
    (latitude IS NOT NULL AND longitude IS NULL) OR
    latitude NOT BETWEEN -90 AND 90 OR longitude NOT BETWEEN -180 AND 180`);
  if (invalid.length) throw new Error(`Invalid existing station coordinates: ${invalid.map((row) => row.code).join(', ')}`);

  let updated = 0;
  const missing = [];
  await db.beginTransaction();
  try {
    for (const item of coordinates) {
      const [result] = await db.query(
        'UPDATE stations SET latitude=?, longitude=? WHERE code=? AND latitude IS NULL AND longitude IS NULL',
        [item.latitude, item.longitude, item.code],
      );
      updated += result.affectedRows;
      const [found] = await db.query('SELECT id FROM stations WHERE code=?', [item.code]);
      if (!found.length) missing.push(item.code);
    }
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }

  const [constraints] = await db.query(`SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stations' AND CONSTRAINT_NAME='chk_stations_coordinates'`);
  if (!constraints.length) {
    await db.query(`ALTER TABLE stations ADD CONSTRAINT chk_stations_coordinates CHECK
      ((latitude IS NULL AND longitude IS NULL) OR
       (latitude IS NOT NULL AND longitude IS NOT NULL AND
        latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))`);
  }

  for (const [name, data] of Object.entries(snapshot)) {
    const preservedColumns = name === 'stations'
      ? data.columns.filter((column) => !['latitude', 'longitude'].includes(column))
      : data.columns;
    const originalRows = data.rows.map((row) => Object.fromEntries(preservedColumns.map((column) => [column, row[column]])));
    const [currentRows] = await db.query('SELECT ?? FROM ?? ORDER BY id', [preservedColumns, name]);
    if (hash(originalRows) !== hash(currentRows)) {
      throw new Error(`Original data changed in ${name}; investigate backup ${backupPath}`);
    }
  }
  const [count] = await db.query('SELECT COUNT(*) AS total, SUM(latitude IS NOT NULL AND longitude IS NOT NULL) AS located FROM stations');
  console.log(`Updated ${updated} demo stations; ${count[0].located}/${count[0].total} stations have coordinates`);
  if (missing.length) console.log(`Demo codes absent from this database: ${missing.join(', ')}`);
  console.log('All original non-coordinate columns and rows preserved');
} finally {
  await db.end();
}

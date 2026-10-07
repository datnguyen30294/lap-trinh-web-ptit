// Add geometry and fill only matching, unmodified demo routes. Never replay seed.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'backend/package.json'));
const mysql = require('mysql2/promise');
process.loadEnvFile(resolve(root, '.env'));
const db = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  supportBigNumbers: true, bigNumberStrings: true, dateStrings: true,
});
const hash = (data) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
try {
  const seed = await readFile(resolve(root, 'database/02-seed-hanoi.sql'), 'utf8');
  const bundled = [...seed.matchAll(/UPDATE routes SET geometry='([^'\r\n]+)' WHERE code='([^']+)' AND geometry IS NULL;/g)]
    .map(([, json, code]) => ({ json, code, stored: JSON.parse(json) }));
  if (bundled.length !== 6) throw new Error('Expected six bundled route geometries');
  const [tables] = await db.query('SHOW FULL TABLES WHERE Table_type="BASE TABLE"');
  const snapshot = {};
  for (const table of tables) {
    const name = Object.values(table)[0];
    const [columns] = await db.query('SHOW COLUMNS FROM ??', [name]);
    const [schema] = await db.query('SHOW CREATE TABLE ??', [name]);
    const [rows] = await db.query('SELECT * FROM ?? ORDER BY id', [name]);
    snapshot[name] = { columns: columns.map((c) => c.Field), schema: schema[0]['Create Table'], rows };
  }
  if (!snapshot.routes || !snapshot.route_stops || !snapshot.stations?.columns.includes('latitude'))
    throw new Error('Expected GoBus application schema with station coordinates. Run migration 006 first.');
  const backupDir = resolve(root, '.local/backups');
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const backup = resolve(backupDir, `route-geometry-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(backup, JSON.stringify({ database: process.env.DB_NAME, snapshot }), { mode: 0o600 });
  console.log(`Private backup saved: ${backup}`);
  if (!snapshot.routes.columns.includes('geometry')) await db.query('ALTER TABLE routes ADD COLUMN geometry JSON NULL');
  await db.beginTransaction();
  let filled = 0;
  const changed = new Set();
  try {
    for (const item of bundled) {
      const [[route]] = await db.query('SELECT id,geometry FROM routes WHERE code=?', [item.code]);
      if (!route || route.geometry != null) continue;
      const [rows] = await db.query(`SELECT s.code,s.latitude,s.longitude,rs.stop_order FROM route_stops rs
        JOIN stations s ON s.id=rs.station_id WHERE rs.route_id=? ORDER BY rs.stop_order`, [route.id]);
      const matches = rows.length === item.stored.stops.length && rows.every((s, i) => {
        const expected = item.stored.stops[i];
        return s.code === expected.code && s.latitude != null && s.longitude != null
          && Number(s.latitude) === expected.latitude && Number(s.longitude) === expected.longitude && s.stop_order === expected.stop_order;
      });
      if (!matches) { console.log(`Skipped modified route ${item.code}`); continue; }
      const [result] = await db.query('UPDATE routes SET geometry=? WHERE id=? AND geometry IS NULL', [item.json, route.id]);
      filled += result.affectedRows;
      if (result.affectedRows) changed.add(String(route.id));
    }
    for (const [name, before] of Object.entries(snapshot)) {
      const [after] = await db.query('SELECT ?? FROM ?? ORDER BY id', [before.columns, name]);
      const preserved = (rows) => rows.map((row) => {
        const copy = { ...row };
        if (name === 'routes' && changed.has(String(row.id))) delete copy.geometry;
        return copy;
      });
      if (hash(preserved(before.rows)) !== hash(preserved(after))) throw new Error(`Original data changed in ${name}`);
    }
    await db.commit();
  } catch (error) { await db.rollback(); throw error; }
  const [counts] = await db.query('SELECT COUNT(*) AS total,SUM(geometry IS NOT NULL) AS with_geometry FROM routes');
  console.log(`Filled ${filled} routes. Stored geometry: ${counts[0].with_geometry}/${counts[0].total}. Original business data preserved.`);
} finally { await db.end(); }

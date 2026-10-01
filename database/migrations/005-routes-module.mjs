// Add nullable travel minutes without inventing historical timing data.
// Never replay the seed against an existing database.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "backend/package.json"));
const mysql = require("mysql2/promise");
process.loadEnvFile(resolve(root, ".env"));
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
const hash = (rows) =>
  createHash("sha256").update(JSON.stringify(rows)).digest("hex");
try {
  const [tables] = await db.query(
    'SHOW FULL TABLES WHERE Table_type = "BASE TABLE"',
  );
  const snapshot = {};
  for (const table of tables) {
    const name = Object.values(table)[0];
    const [columns] = await db.query("SHOW COLUMNS FROM ??", [name]);
    const [schema] = await db.query("SHOW CREATE TABLE ??", [name]);
    const [rows] = await db.query("SELECT * FROM ?? ORDER BY id", [name]);
    snapshot[name] = {
      columns: columns.map((c) => c.Field),
      schema: schema[0]["Create Table"],
      rows,
      hash: hash(rows),
    };
  }
  const backupDir = resolve(root, ".local/backups");
  await mkdir(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = resolve(
    backupDir,
    `routes-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  await writeFile(
    backupPath,
    JSON.stringify({ database: process.env.DB_NAME, snapshot }, null, 2),
    { mode: 0o600 },
  );
  console.log(`Backup saved: ${backupPath}`);
  const additions = [
    [
      "route_stops",
      "minutes_from_origin",
      "ALTER TABLE route_stops ADD COLUMN minutes_from_origin SMALLINT UNSIGNED NULL",
    ],
  ];
  for (const [table, column, ddl] of additions) {
    if (!snapshot[table])
      throw new Error(
        `Missing table ${table}; no table will be created automatically.`,
      );
    if (!snapshot[table].columns.includes(column)) {
      await db.query(ddl);
      console.log(`Added ${table}.${column}`);
    } else console.log(`Already exists: ${table}.${column}`);
  }
  for (const [name, data] of Object.entries(snapshot)) {
    const [rows] = await db.query("SELECT ?? FROM ?? ORDER BY id", [
      data.columns,
      name,
    ]);
    if (hash(rows) !== data.hash)
      throw new Error(
        `Original data changed in ${name}; investigate backup ${backupPath}`,
      );
    console.log(
      `Preserved ${name}: ${rows.length} rows; original columns checksum matches`,
    );
  }
} finally {
  await db.end();
}

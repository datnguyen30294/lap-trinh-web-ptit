// Maintenance only: npm run build in backend/ first. Fresh clones do NOT run this.
// Read public demo coordinates from the seed, never export a developer's database.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RoadRoutingService } from '../../backend/dist/journey-planner/road-routing.service.js';
import { stopSnapshot } from '../../backend/dist/journey-planner/route-geometry.js';

const path = fileURLToPath(new URL('../02-seed-hanoi.sql', import.meta.url));
const seed = await readFile(path, 'utf8');
const stations = new Map([...seed.matchAll(/INSERT INTO stations\(code,name,address,latitude,longitude\) SELECT '([^']+)','[^']*','[^']*',([\d.]+),([\d.]+)/g)]
  .map(([, code, lat, lon]) => [code, { code, latitude: Number(lat), longitude: Number(lon) }]));
const roads = new RoadRoutingService();
const statements = [];
for (const section of seed.split('-- Route ').slice(1)) {
  const code = section.match(/^([^;]+);/)[1];
  const stops = [...section.matchAll(/SELECT @rid,id,(\d+),[^\r\n]*?FROM stations WHERE code='([^']+)'/g)]
    .map(([, order, code]) => ({ ...stations.get(code), stop_order: Number(order) }));
  const road = await roads.route(stops);
  const stored = { version: 1, source: 'osrm-driving', stops: stopSnapshot(stops), ...road };
  statements.push(`UPDATE routes SET geometry='${JSON.stringify(stored)}' WHERE code='${code}' AND geometry IS NULL;`);
  console.log(`${code}: ${stops.length} stops, ${road.geometry.coordinates.length} street points`);
}
if (statements.length !== 6) throw new Error('Expected six demo directions');
const start = '-- BEGIN BUNDLED ROUTE GEOMETRY';
const end = '-- END BUNDLED ROUTE GEOMETRY';
const block = `${start}\n-- OSRM driving via selected demo stops, not an official bus alignment.\n-- OSM contributors, ODbL: https://www.openstreetmap.org/copyright\n${statements.join('\n')}\n${end}\n`;
const updated = seed.includes(start)
  ? seed.slice(0, seed.indexOf(start)) + block + seed.slice(seed.indexOf(end) + end.length).replace(/^\r?\n/, '')
  : seed.replace(/COMMIT;/, `${block}\nCOMMIT;`);
await writeFile(path, updated, 'utf8');
console.log('Bundled geometry in 02-seed-hanoi.sql. No database was modified.');

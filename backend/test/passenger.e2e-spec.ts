import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { hash } from 'bcryptjs';
import request from 'supertest';
process.loadEnvFile('../.env');
const prefix = `PH${randomBytes(4).toString('hex')}`;
const url = 'http://127.0.0.1:3104';
let server: ChildProcess;
let db: Connection;
let admin: ReturnType<typeof request.agent>,
  user: ReturnType<typeof request.agent>;
const stationIds: string[] = [];
const routeIds: string[] = [];
const baseline: Record<string, { ids: string[]; hash: string }> = {};
const digest = (rows: unknown) =>
  createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const login = (
  agent: ReturnType<typeof request.agent>,
  email: string | undefined,
  password: string | undefined,
) =>
  agent
    .post('/auth/login')
    .set('X-GoBus-Request', '1')
    .send({ email, password });
beforeAll(async () => {
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
  });
  const [tables] = await db.query<RowDataPacket[]>(
    'SHOW FULL TABLES WHERE Table_type="BASE TABLE"',
  );
  for (const row of tables) {
    const table = String(Object.values(row)[0]);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM ?? ORDER BY id',
      [table],
    );
    baseline[table] = {
      ids: rows.map((r) => String(r.id)),
      hash: digest(rows),
    };
  }
  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: '3104', NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch(url)).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Passenger test API did not start');
  admin = request.agent(url);
  user = request.agent(url);
  await login(
    admin,
    process.env.TEST_ADMIN_EMAIL,
    process.env.TEST_ADMIN_PASSWORD,
  ).expect(200);
  await login(
    user,
    process.env.TEST_USER_EMAIL,
    process.env.TEST_USER_PASSWORD,
  ).expect(200);
  for (let i = 0; i < 3; i++) {
    const response = await admin
      .post('/stations')
      .set('X-GoBus-Request', '1')
      .send({
        code: `${prefix}S${i}`,
        name: `${prefix} Bến ${i}`,
        address: 'Kiểm thử trang chủ',
      })
      .expect(201);
    stationIds.push(response.body.id);
  }
  for (let i = 0; i < 3; i++) {
    const response = await admin
      .post('/routes')
      .set('X-GoBus-Request', '1')
      .send({
        code: `${prefix}R${i}`,
        name: `${prefix} Tuyến ${i}`,
        origin_station_id: stationIds[0],
        destination_station_id: stationIds[2],
        operating_start: '05:00:00',
        operating_end: '22:00:00',
        distance_km: 10,
        status: i === 2 ? 'INACTIVE' : 'ACTIVE',
        stops: stationIds.map((id, index) => ({
          station_id: id,
          stop_order: index + 1,
          minutes_from_origin: index * 10,
          km_from_origin: index * 5,
        })),
      })
      .expect(201);
    routeIds.push(response.body.id);
  }
}, 20000);
afterAll(async () => {
  try {
    if (db) {
      await db.query(
        'DELETE rs FROM route_stops rs JOIN routes r ON r.id=rs.route_id WHERE r.code LIKE ?',
        [`${prefix}%`],
      );
      await db.query('DELETE FROM routes WHERE code LIKE ?', [`${prefix}%`]);
      await db.query('DELETE FROM stations WHERE code LIKE ?', [`${prefix}%`]);
      await db.query('DELETE FROM users WHERE email=?', [
        `${prefix}@example.test`,
      ]);
      for (const [table, snapshot] of Object.entries(baseline)) {
        const [rows] = await db.query<RowDataPacket[]>(
          'SELECT * FROM ?? ORDER BY id',
          [table],
        );
        expect(digest(rows), `All original rows in ${table} preserved`).toBe(
          snapshot.hash,
        );
      }
    }
  } finally {
    await db?.end();
    if (server?.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
  }
}, 15000);
describe('Passenger APIs with real MySQL and session cookies', () => {
  it('requires a session on both passenger endpoints', async () => {
    await request(url).get('/passenger/stations').expect(401);
    await request(url).get('/passenger/routes').expect(401);
  });
  it('lists real active stations without administration fields', async () => {
    const response = await user.get('/passenger/stations').expect(200);
    expect(response.body.map((s: { id: string }) => s.id)).toEqual(
      expect.arrayContaining(stationIds),
    );
    expect(Object.keys(response.body[0]).sort()).toEqual([
      'code',
      'id',
      'name',
    ]);
    await admin.get('/passenger/stations').expect(200);
  });
  it('finds intermediate segments in the forward direction and paginates', async () => {
    const filters = {
      from_station_id: stationIds[1],
      to_station_id: stationIds[2],
      limit: 1,
    };
    const response = await user
      .get('/passenger/routes')
      .query(filters)
      .expect(200);
    expect(response.body).toMatchObject({ total: 2, page: 1, totalPages: 2 });
    expect(
      response.body.items[0].stops.map(
        (s: { station_id: string }) => s.station_id,
      ),
    ).toEqual(stationIds);
    expect(response.body.items[0].operating_start).toBe('05:00:00');
    expect(response.body.items[0].distance_km).toBe(10);
    const second = await user
      .get('/passenger/routes')
      .query({ ...filters, page: 2 })
      .expect(200);
    expect(second.body.items[0].id).not.toBe(response.body.items[0].id);
    const reversed = await user
      .get('/passenger/routes')
      .query({ from_station_id: stationIds[2], to_station_id: stationIds[0] })
      .expect(200);
    expect(reversed.body.total).toBe(0);
  });
  it('supports route suggestions but never reveals inactive routes', async () => {
    const active = await user
      .get('/passenger/routes')
      .query({ route_id: routeIds[0] })
      .expect(200);
    expect(active.body.items[0].id).toBe(routeIds[0]);
    const inactive = await user
      .get('/passenger/routes')
      .query({ route_id: routeIds[2] })
      .expect(200);
    expect(inactive.body.total).toBe(0);
  });
  it('filters routes with an inactive intermediate stop', async () => {
    // Only this suite owns this station; restore even if an assertion fails.
    await db.query('UPDATE stations SET is_active=0 WHERE id=?', [
      stationIds[1],
    ]);
    try {
      const routes = await user
        .get('/passenger/routes')
        .query({ route_id: routeIds[0] })
        .expect(200);
      expect(routes.body.total).toBe(0);
      const stations = await user.get('/passenger/stations').expect(200);
      expect(stations.body.map((s: { id: string }) => s.id)).not.toContain(
        stationIds[1],
      );
    } finally {
      await db.query('UPDATE stations SET is_active=1 WHERE id=?', [
        stationIds[1],
      ]);
    }
  });
  it('validates pairs, IDs, pagination and unexpected fields', async () => {
    for (const query of [
      { from_station_id: stationIds[0] },
      { to_station_id: stationIds[2] },
      { from_station_id: stationIds[0], to_station_id: stationIds[0] },
      { route_id: '0' },
      { route_id: '18446744073709551616' },
      { route_id: '1 OR 1=1' },
      { page: '0' },
      { page: '1.5' },
      { limit: 51 },
      { role: 'ADMIN' },
    ])
      await user.get('/passenger/routes').query(query).expect(400);
  });
  it('preserves ADMIN guards on all administration modules', async () => {
    for (const path of ['/stations', '/routes', '/schedules']) {
      await user.get(path).expect(403);
      await user.post(path).set('X-GoBus-Request', '1').send({}).expect(403);
      await admin.get(path).expect(200);
    }
  });
  it('rechecks active state in MySQL and clears access after logout', async () => {
    const password = randomBytes(20).toString('hex');
    await db.query(
      'INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)',
      [prefix, `${prefix}@example.test`, await hash(password, 4), 'USER'],
    );
    const member = request.agent(url);
    const response = await login(
      member,
      `${prefix}@example.test`,
      password,
    ).expect(200);
    expect(response.body).not.toHaveProperty('password_hash');
    await member.get('/auth/me').expect(200);
    await db.query('UPDATE users SET is_active=0 WHERE email=?', [
      `${prefix}@example.test`,
    ]);
    await member.get('/passenger/routes').expect(401);
    await member.get('/auth/me').expect(401);
    await user.post('/auth/logout').set('X-GoBus-Request', '1').expect(200);
    await user.get('/passenger/routes').expect(401);
    await user.get('/auth/me').expect(401);
  });
});

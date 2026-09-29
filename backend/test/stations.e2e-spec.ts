import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import request from 'supertest';

// Real HTTP + real MySQL. Only fixtures created by this suite are removed.
// Existing rows are fingerprinted before/after to prove preservation (AC-4).
process.loadEnvFile('../.env');
const prefix = `T${randomBytes(5).toString('hex')}`;
const url = 'http://127.0.0.1:3101';
let server: ChildProcess;
let db: Connection;
let admin: ReturnType<typeof request.agent>;
let user: ReturnType<typeof request.agent>;
let baseline: Record<string, { ids: string[]; hash: string }>;
const digest = (rows: unknown) =>
  createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const tables = [
  'stations',
  'routes',
  'route_stops',
  'schedules',
  'bookings',
  'users',
];
const adminEmail = process.env.TEST_ADMIN_EMAIL!;
const adminPassword = process.env.TEST_ADMIN_PASSWORD!;
const userEmail = process.env.TEST_USER_EMAIL!;
const userPassword = process.env.TEST_USER_PASSWORD!;
const body = (code = `${prefix}A`) => ({
  code,
  name: `Bến kiểm thử ${prefix}`,
  address: `Địa chỉ kiểm thử ${prefix}`,
});
const mutate = (
  agent: ReturnType<typeof request.agent>,
  method: 'post' | 'patch',
  path: string,
  value: unknown,
) => agent[method](path).set('X-GoBus-Request', '1').send(value);
async function create(code?: string) {
  const response = await mutate(admin, 'post', '/stations', body(code)).expect(
    201,
  );
  return response.body;
}

beforeAll(async () => {
  if (!adminEmail || !adminPassword || !userEmail || !userPassword)
    throw new Error(
      'Set TEST_ADMIN_EMAIL/PASSWORD and TEST_USER_EMAIL/PASSWORD in ignored root .env.',
    );
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
  baseline = {};
  for (const table of tables) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM ?? ORDER BY id',
      [table],
    );
    baseline[table] = {
      ids: rows.map((row) => String(row.id)),
      hash: digest(rows),
    };
  }
  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: '3101', NODE_ENV: 'test' },
    stdio: 'pipe',
  });
  let logs = '';
  server.stdout?.on('data', (data) => {
    logs += data.toString();
  });
  server.stderr?.on('data', (data) => {
    logs += data.toString();
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await fetch(url)).ok;
    } catch {
      /* Wait only for the local server to start. */
    }
    if (ready) break;
    if (server.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`Server did not start: ${logs}`);
  admin = request.agent(url);
  user = request.agent(url);
  await mutate(admin, 'post', '/auth/login', {
    email: adminEmail,
    password: adminPassword,
  }).expect(200);
  await mutate(user, 'post', '/auth/login', {
    email: userEmail,
    password: userPassword,
  }).expect(200);
}, 20000);

afterAll(async () => {
  try {
    if (db) {
      // Narrow deletion to this run's generated codes, including any successful concurrent request.
      await db.query('DELETE FROM stations WHERE code LIKE ?', [`${prefix}%`]);
      for (const [table, snapshot] of Object.entries(baseline ?? {})) {
        if (!snapshot.ids.length) continue;
        const [rows] = await db.query(
          'SELECT * FROM ?? WHERE id IN (?) ORDER BY id',
          [table, snapshot.ids],
        );
        expect(digest(rows), `Original data changed: ${table}`).toBe(
          snapshot.hash,
        );
      }
    }
  } finally {
    await db?.end();
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
  }
}, 10000);

describe('Stations API, real database', () => {
  it('AC-1 returns paginated real rows and deterministic pages', async () => {
    const first = await admin.get('/stations?limit=2&page=1').expect(200);
    const second = await admin.get('/stations?limit=2&page=2').expect(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.total).toBe(baseline.stations.ids.length);
    expect(first.body.totalPages).toBe(Math.ceil(first.body.total / 2));
    expect(
      second.body.items.map((item: { id: string }) => item.id),
    ).not.toContain(first.body.items[0].id);
    expect(first.body.items[0]).toMatchObject({
      id: expect.any(String),
      is_active: expect.any(Boolean),
    });
  });
  it('AC-2/3 creates, edits, deactivates and reactivates a station while keeping its ID', async () => {
    const created = await create();
    expect(created.is_active).toBe(true);
    const changed = await mutate(admin, 'patch', `/stations/${created.id}`, {
      ...body(),
      name: '  Bến đã sửa  ',
    }).expect(200);
    expect(changed.body).toMatchObject({
      id: created.id,
      name: 'Bến đã sửa',
      is_active: true,
    });
    await mutate(admin, 'patch', `/stations/${created.id}/status`, {
      is_active: false,
    }).expect(200);
    const inactive = await admin
      .get(`/stations?is_active=false&search=${prefix}`)
      .expect(200);
    expect(inactive.body.items).toEqual([
      expect.objectContaining({ id: created.id, is_active: false }),
    ]);
    const reactivated = await mutate(
      admin,
      'patch',
      `/stations/${created.id}/status`,
      { is_active: true },
    ).expect(200);
    expect(reactivated.body.is_active).toBe(true);
    expect(
      (await admin.get(`/stations?is_active=false&search=${prefix}`)).body
        .total,
    ).toBe(0);
  });
  it('AC-1 searches code, name and address and escapes LIKE wildcards', async () => {
    const created = await create(`${prefix}S`);
    for (const search of [created.code, created.name, created.address]) {
      const result = await admin.get('/stations').query({ search }).expect(200);
      expect(
        result.body.items.map((item: { id: string }) => item.id),
      ).toContain(created.id);
    }
    const empty = await admin
      .get('/stations')
      .query({ search: `${prefix}%_!` })
      .expect(200);
    expect(empty.body).toMatchObject({ items: [], total: 0, totalPages: 0 });
  });
  it('AC-2 rejects duplicate codes, including case differences and edits', async () => {
    const station = await create(`${prefix}D`);
    const other = await create(`${prefix}E`);
    await mutate(
      admin,
      'post',
      '/stations',
      body(station.code.toLowerCase()),
    ).expect(409);
    const conflict = await mutate(
      admin,
      'patch',
      `/stations/${other.id}`,
      body(station.code),
    ).expect(409);
    expect(conflict.body.message).toContain('Mã bến đã tồn tại');
  });
  it('AC-2 enforces unique codes during concurrent inserts', async () => {
    const results = await Promise.all(
      [0, 1].map(() => mutate(admin, 'post', '/stations', body(`${prefix}R`))),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });
  it('AC-2 accepts schema maximum lengths and trims input', async () => {
    const data = {
      code: `${prefix}${'Z'.repeat(20 - prefix.length)}`,
      name: 'ế'.repeat(160),
      address: 'Đ'.repeat(255),
    };
    const result = await mutate(admin, 'post', '/stations', {
      ...data,
      code: ` ${data.code} `,
    }).expect(201);
    expect(result.body).toMatchObject(data);
  });
  it.each([
    ['code', ''],
    ['code', '   '],
    ['name', '  '],
    ['address', ''],
    ['code', 'a'.repeat(21)],
    ['name', 'a'.repeat(161)],
    ['address', 'a'.repeat(256)],
    ['code', null],
    ['name', 42],
    ['address', []],
    ['is_active', false],
    ['id', '2'],
  ])('AC-2 rejects invalid body field %s = %j', async (field, value) => {
    await mutate(admin, 'post', '/stations', {
      ...body(`${prefix}V`),
      [field as string]: value,
    }).expect(400);
  });
  it('AC-2 rejects omitted mandatory fields', async () => {
    await mutate(admin, 'post', '/stations', { code: `${prefix}M` }).expect(
      400,
    );
  });
  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=1000001',
    'limit=0',
    'limit=101',
    'limit=abc',
    'is_active=1',
    'is_active=null',
    'unknown=x',
    'search=' + 'x'.repeat(256),
  ])('AC-1 rejects invalid query %s', async (query) => {
    await admin.get(`/stations?${query}`).expect(400);
  });
  it.each(['0', '-1', '1.2', 'abc', '18446744073709551616'])(
    'AC-2 rejects invalid ID %s',
    async (id) => {
      await mutate(admin, 'patch', `/stations/${id}`, body()).expect(400);
    },
  );
  it('AC-2 returns 404 for a missing ID on both updates', async () => {
    await mutate(
      admin,
      'patch',
      '/stations/18446744073709551615',
      body(),
    ).expect(404);
    await mutate(admin, 'patch', '/stations/18446744073709551615/status', {
      is_active: false,
    }).expect(404);
  });
  it.each([null, 'false', 0, {}, undefined])(
    'AC-3 rejects non boolean status %j',
    async (value) => {
      await mutate(admin, 'patch', '/stations/1/status', {
        is_active: value,
      }).expect(400);
    },
  );
  it('AC-4 blocks deactivation for both endpoint and intermediate active route stations', async () => {
    const [routes] = await db.query<RowDataPacket[]>(
      "SELECT * FROM routes WHERE status='ACTIVE' LIMIT 1",
    );
    expect(routes.length).toBeGreaterThan(0);
    const [stops] = await db.query<RowDataPacket[]>(
      'SELECT station_id FROM route_stops WHERE route_id=? AND station_id NOT IN (?,?) LIMIT 1',
      [
        routes[0].id,
        routes[0].origin_station_id,
        routes[0].destination_station_id,
      ],
    );
    expect(stops.length).toBeGreaterThan(0);
    for (const id of [
      routes[0].origin_station_id,
      routes[0].destination_station_id,
      stops[0].station_id,
    ]) {
      const blocked = await mutate(admin, 'patch', `/stations/${id}/status`, {
        is_active: false,
      }).expect(409);
      expect(
        blocked.body.routes.map((r: { code: string }) => r.code),
      ).toContain(routes[0].code);
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT is_active FROM stations WHERE id=?',
        [id],
      );
      expect(rows[0].is_active).toBe(1);
    }
  });
  it('AC-5 denies anonymous access, USER access and client supplied roles on every station action', async () => {
    for (const agent of [request.agent(url), user]) {
      const expected = agent === user ? 403 : 401;
      await agent.get('/stations').set('X-Role', 'ADMIN').expect(expected);
      await mutate(agent, 'post', '/stations', body()).expect(expected);
      await mutate(agent, 'patch', '/stations/1', body()).expect(expected);
      await mutate(agent, 'patch', '/stations/1/status', {
        is_active: false,
      }).expect(expected);
    }
  });
  it('AC-5 denies wrong credentials without exposing account details or password hashes', async () => {
    const result = await mutate(request.agent(url), 'post', '/auth/login', {
      email: adminEmail,
      password: 'incorrect',
    }).expect(401);
    expect(result.body.message).toBe('Email hoặc mật khẩu không đúng.');
    const me = await admin.get('/auth/me').expect(200);
    expect(Object.keys(me.body).sort()).toEqual([
      'email',
      'full_name',
      'id',
      'role',
    ]);
    expect(JSON.stringify(me.body)).not.toContain('password');
  });
  it('AC-5 rejects forged cookies, invalid origins, and mutations missing CSRF header', async () => {
    await request(url)
      .get('/stations')
      .set('Cookie', 'gobus.sid=s%3Aforged.invalid')
      .expect(401);
    await admin.post('/stations').send(body()).expect(403);
    await mutate(admin, 'post', '/stations', body())
      .set('Origin', 'https://untrusted.example')
      .expect(403);
  });
  it('AC-5 invalidates the session on logout and uses HttpOnly, SameSite cookies', async () => {
    const actor = request.agent(url);
    const login = await mutate(actor, 'post', '/auth/login', {
      email: adminEmail,
      password: adminPassword,
    }).expect(200);
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    await mutate(actor, 'post', '/auth/logout', {}).expect(200);
    await actor.get('/stations').expect(401);
    await request(url)
      .get('/stations')
      .set('Cookie', cookie.split(';')[0])
      .expect(401);
  });
});

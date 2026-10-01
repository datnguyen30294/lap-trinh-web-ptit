import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
process.loadEnvFile('../.env');
const prefix = `RT${randomBytes(4).toString('hex')}`;
const url = 'http://127.0.0.1:3102';
let db: Connection, server: ChildProcess;
let admin: ReturnType<typeof request.agent>,
  user: ReturnType<typeof request.agent>;
let stationIds: string[] = [],
  vehicleId: string,
  userId: string;
let sequence = 0;
const baseline: Record<string, { ids: string[]; hash: string }> = {};
const hash = (data: unknown) =>
  createHash('sha256').update(JSON.stringify(data)).digest('hex');
const mutate = (
  agent: ReturnType<typeof request.agent>,
  method: 'post' | 'patch',
  path: string,
  body: unknown,
) => agent[method](path).set('X-GoBus-Request', '1').send(body);
const body = (overrides: Record<string, unknown> = {}) => ({
  code: `${prefix}${++sequence}`,
  name: `Tuyến thử ${prefix}`,
  origin_station_id: stationIds[0],
  destination_station_id: stationIds[2],
  operating_start: '05:00:00',
  operating_end: '22:00:00',
  distance_km: 10,
  status: 'ACTIVE',
  stops: stationIds.slice(0, 3).map((id, i) => ({
    station_id: id,
    stop_order: i + 1,
    minutes_from_origin: i * 10,
    km_from_origin: i * 5,
  })),
  ...overrides,
});
const edit = (r: ReturnType<typeof body>) => {
  const { status: _status, ...dto } = r;
  return dto;
};
async function create(overrides: Record<string, unknown> = {}) {
  const data = body(overrides);
  const response = await mutate(admin, 'post', '/routes', data).expect(201);
  return { data, route: response.body };
}
async function schedule(routeId: string) {
  const [result] = await db.query<mysql.ResultSetHeader>(
    "INSERT INTO schedules (route_id,vehicle_id,departure_at,arrival_at) VALUES (?,?, '2099-01-01 01:00:00','2099-01-01 01:20:00')",
    [routeId, vehicleId],
  );
  // Unique vehicle/departure: allocate a separate vehicle for each fixture schedule.
  const id = String(result.insertId);
  const [v] = await db.query<mysql.ResultSetHeader>(
    'INSERT INTO vehicles (vehicle_code,capacity) VALUES (?,30)',
    [`${prefix}V${++sequence}`],
  );
  vehicleId = String(v.insertId);
  return id;
}
async function booking(scheduleId: string, status = 'CONFIRMED') {
  await db.query(
    `INSERT INTO bookings (booking_code,user_id,schedule_id,from_station_id,to_station_id,passenger_name,contact_phone,unit_price,status,cancelled_at) VALUES (?,?,?,?,?,'Kiểm thử','0000000000',10000,?,${status === 'CANCELLED' ? 'UTC_TIMESTAMP(3)' : 'NULL'})`,
    [
      `${prefix}B${++sequence}`,
      userId,
      scheduleId,
      stationIds[0],
      stationIds[2],
      status,
    ],
  );
}
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
    const t = String(Object.values(row)[0]);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM ?? ORDER BY id',
      [t],
    );
    baseline[t] = { ids: rows.map((r) => String(r.id)), hash: hash(rows) };
  }
  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: '3102', NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch(url)).ok;
    } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) throw new Error('Test API did not start.');
  admin = request.agent(url);
  user = request.agent(url);
  await mutate(admin, 'post', '/auth/login', {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  }).expect(200);
  const login = await mutate(user, 'post', '/auth/login', {
    email: process.env.TEST_USER_EMAIL,
    password: process.env.TEST_USER_PASSWORD,
  }).expect(200);
  userId = String(login.body.id);
  for (let i = 0; i < 4; i++) {
    const r = await mutate(admin, 'post', '/stations', {
      code: `${prefix}S${i}`,
      name: `Bến thử ${i}`,
      address: 'Kiểm thử tuyến',
    }).expect(201);
    stationIds.push(r.body.id);
  }
  const [v] = await db.query<mysql.ResultSetHeader>(
    'INSERT INTO vehicles (vehicle_code,capacity) VALUES (?,30)',
    [`${prefix}V0`],
  );
  vehicleId = String(v.insertId);
}, 20000);
afterAll(async () => {
  try {
    if (db) {
      await db.query(
        'DELETE b FROM bookings b JOIN schedules s ON s.id=b.schedule_id JOIN routes r ON r.id=s.route_id WHERE r.code LIKE ?',
        [`${prefix}%`],
      );
      await db.query(
        'DELETE s FROM schedules s JOIN routes r ON r.id=s.route_id WHERE r.code LIKE ?',
        [`${prefix}%`],
      );
      await db.query(
        'DELETE rs FROM route_stops rs JOIN routes r ON r.id=rs.route_id WHERE r.code LIKE ?',
        [`${prefix}%`],
      );
      await db.query('DELETE FROM routes WHERE code LIKE ?', [`${prefix}%`]);
      await db.query('DELETE FROM stations WHERE code LIKE ?', [`${prefix}%`]);
      await db.query('DELETE FROM vehicles WHERE vehicle_code LIKE ?', [
        `${prefix}%`,
      ]);
      for (const [table, snapshot] of Object.entries(baseline)) {
        if (!snapshot.ids.length) continue;
        const [rows] = await db.query(
          'SELECT * FROM ?? WHERE id IN (?) ORDER BY id',
          [table, snapshot.ids],
        );
        expect(hash(rows), `Original ${table} preserved`).toBe(snapshot.hash);
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
describe('Routes API with real MySQL, AC-1 to AC-7', () => {
  it('AC-1/2 creates, trims, lists, filters, paginates and reads ordered stops', async () => {
    const { route } = await create({
      code: ` ${prefix}TRIM `,
      name: '  Tuyến mới  ',
    });
    expect(route.code).toBe(`${prefix}TRIM`);
    expect(route.name).toBe('Tuyến mới');
    expect(
      route.stops.map((s: { stop_order: number }) => s.stop_order),
    ).toEqual([1, 2, 3]);
    const list = await admin
      .get('/routes')
      .query({ search: prefix, limit: 1, page: 1 })
      .expect(200);
    expect(list.body.items[0].id).toBe(route.id);
    expect(list.body.items[0].stop_count).toBe(3);
    const detail = await admin.get(`/routes/${route.id}`).expect(200);
    expect(detail.body).toMatchObject({
      distance_km: 10,
      has_bookings: false,
      schedule_count: 0,
    });
    await mutate(admin, 'patch', `/routes/${route.id}/status`, {
      status: 'INACTIVE',
    }).expect(200);
    const filtered = await admin
      .get('/routes')
      .query({ search: prefix, status: 'INACTIVE' })
      .expect(200);
    expect(filtered.body.items.map((r: { id: string }) => r.id)).toContain(
      route.id,
    );
    await mutate(admin, 'patch', `/routes/${route.id}/status`, {
      status: 'ACTIVE',
    }).expect(200);
    expect(
      (await admin.get('/routes').query({ search: `${prefix}%_!` })).body.total,
    ).toBe(0);
  });
  it('AC-2 rejects duplicate codes on create and update and rolls back replaced stops', async () => {
    const a = await create(),
      b = await create();
    await mutate(admin, 'post', '/routes', {
      ...a.data,
      code: a.data.code.toLowerCase(),
    }).expect(409);
    const dto = edit(b.data);
    dto.stops[1].minutes_from_origin = 11;
    await mutate(admin, 'patch', `/routes/${b.route.id}`, {
      ...dto,
      code: a.data.code,
    }).expect(409);
    const after = await admin.get(`/routes/${b.route.id}`);
    expect(after.body.stops).toEqual(b.route.stops);
    expect(after.body.code).toBe(b.data.code);
  });
  it('AC-2 accepts schema boundaries and rejects invalid nested input with useful messages', async () => {
    const data = body({
      code: `${prefix}${'X'.repeat(20 - prefix.length)}`,
      name: 'ế'.repeat(180),
    });
    await mutate(admin, 'post', '/routes', data).expect(201);
    for (const patch of [
      { code: '' },
      { name: ' ' },
      { code: 'x'.repeat(21) },
      { name: 'x'.repeat(181) },
      { distance_km: 0 },
      { distance_km: 1.123 },
      { operating_start: '22:00', operating_end: '05:00' },
      { operating_start: '25:00' },
      { status: 'DELETED' },
      { unknown: true },
      { stops: [] },
      { stops: null },
      { origin_station_id: '0' },
    ])
      await mutate(admin, 'post', '/routes', body(patch)).expect(400);
    const invalid = body();
    invalid.stops[1].minutes_from_origin = 1.5;
    const response = await mutate(admin, 'post', '/routes', invalid).expect(
      400,
    );
    expect(response.body.message.join(' ')).toContain(
      'Số phút phải là số nguyên',
    );
  });
  it.each([
    'duplicate',
    'order',
    'first-minutes',
    'first-km',
    'minutes',
    'km',
    'last-km',
    'null',
    'missing-station',
    'oversize-id',
    'endpoint',
  ])('AC-2 rejects invalid journey %s', async (kind) => {
    const dto = body();
    if (kind === 'duplicate') dto.stops[1].station_id = dto.stops[0].station_id;
    if (kind === 'order') dto.stops[1].stop_order = 3;
    if (kind === 'first-minutes') dto.stops[0].minutes_from_origin = 1;
    if (kind === 'first-km') dto.stops[0].km_from_origin = 1;
    if (kind === 'minutes') dto.stops[2].minutes_from_origin = 10;
    if (kind === 'km') dto.stops[1].km_from_origin = 10;
    if (kind === 'last-km') dto.distance_km = 11;
    if (kind === 'null')
      (
        dto.stops[1] as { minutes_from_origin: number | null }
      ).minutes_from_origin = null;
    if (kind === 'missing-station')
      dto.stops[1].station_id = '18446744073709551615';
    if (kind === 'oversize-id')
      dto.stops[1].station_id = '18446744073709551616';
    if (kind === 'endpoint') dto.origin_station_id = stationIds[1];
    await mutate(admin, 'post', '/routes', dto).expect(400);
  });
  it('AC-2 changes a permitted journey and preserves stop IDs on metadata-only updates', async () => {
    const { route, data } = await create();
    const dto = edit(data);
    dto.stops[1].station_id = stationIds[3];
    const updated = await mutate(
      admin,
      'patch',
      `/routes/${route.id}`,
      dto,
    ).expect(200);
    expect(updated.body.stops[1].station_id).toBe(stationIds[3]);
    const metadata = await mutate(admin, 'patch', `/routes/${route.id}`, {
      ...dto,
      name: 'Tên đã sửa',
    }).expect(200);
    expect(metadata.body.stops).toEqual(updated.body.stops);
  });
  it('AC-3 blocks inactive stations on creation and activation, and stations cannot deactivate active intermediate stops', async () => {
    const { route } = await create();
    await mutate(admin, 'patch', `/stations/${stationIds[1]}/status`, {
      is_active: false,
    }).expect(409);
    const unused = await mutate(admin, 'post', '/stations', {
      code: `${prefix}OFF`,
      name: 'Bến ngừng',
      address: 'Test',
    }).expect(201);
    await mutate(admin, 'patch', `/stations/${unused.body.id}/status`, {
      is_active: false,
    }).expect(200);
    const data = body();
    data.stops[1].station_id = unused.body.id;
    await mutate(admin, 'post', '/routes', data).expect(409);
    const inactive = await mutate(admin, 'post', '/routes', {
      ...data,
      status: 'INACTIVE',
    }).expect(201);
    await mutate(admin, 'patch', `/routes/${inactive.body.id}/status`, {
      status: 'ACTIVE',
    }).expect(409);
    expect((await admin.get(`/routes/${route.id}`)).body.status).toBe('ACTIVE');
  });
  it.each(['CONFIRMED', 'CANCELLED'])(
    'AC-4 protects historical identity and journey for %s bookings',
    async (status) => {
      const { route, data } = await create();
      const sid = await schedule(route.id);
      await booking(sid, status);
      for (const patch of [
        { code: `${prefix}RENAME` },
        { name: 'Đổi tên' },
        {
          distance_km: 11,
          stops: data.stops.map((s, i) => ({
            ...s,
            km_from_origin: i === 2 ? 11 : s.km_from_origin,
          })),
        },
        {
          stops: data.stops.map((s, i) => ({
            ...s,
            minutes_from_origin: i === 1 ? 11 : s.minutes_from_origin,
          })),
        },
      ])
        await mutate(admin, 'patch', `/routes/${route.id}`, {
          ...edit(data),
          ...patch,
        }).expect(409);
      const unchanged = await mutate(
        admin,
        'patch',
        `/routes/${route.id}`,
        edit(data),
      ).expect(200);
      expect(unchanged.body.has_bookings).toBe(true);
      await mutate(admin, 'patch', `/routes/${route.id}/status`, {
        status: 'INACTIVE',
      }).expect(status === 'CONFIRMED' ? 409 : 200);
    },
  );
  it('AC-4 checks Vietnamese hours and exact duration against existing schedules without modifying them', async () => {
    const { route, data } = await create();
    const sid = await schedule(route.id);
    await mutate(admin, 'patch', `/routes/${route.id}`, {
      ...edit(data),
      operating_start: '09:00',
    }).expect(409);
    await mutate(admin, 'patch', `/routes/${route.id}`, {
      ...edit(data),
      operating_end: '08:10',
    }).expect(409);
    await mutate(admin, 'patch', `/routes/${route.id}`, {
      ...edit(data),
      stops: data.stops.map((s, i) => ({
        ...s,
        minutes_from_origin: i === 2 ? 21 : s.minutes_from_origin,
      })),
    }).expect(409);
    await mutate(admin, 'patch', `/routes/${route.id}`, {
      ...edit(data),
      operating_start: '08:00',
      operating_end: '08:20',
    }).expect(200);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT departure_at,arrival_at FROM schedules WHERE id=?',
      [sid],
    );
    expect(rows[0].arrival_at).toContain('01:20:00');
  });
  it('AC-3 serializes station deactivation against concurrent route activation', async () => {
    for (let i = 0; i < 3; i++) {
      const s = await mutate(admin, 'post', '/stations', {
        code: `${prefix}RACE${i}`,
        name: 'Bến đồng thời',
        address: 'Test',
      }).expect(201);
      const data = body({ status: 'INACTIVE' });
      data.stops[1].station_id = s.body.id;
      const r = await mutate(admin, 'post', '/routes', data).expect(201);
      const results = await Promise.all([
        mutate(admin, 'patch', `/routes/${r.body.id}/status`, {
          status: 'ACTIVE',
        }),
        mutate(admin, 'patch', `/stations/${s.body.id}/status`, {
          is_active: false,
        }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const [bad] = await db.query<RowDataPacket[]>(
        "SELECT r.id FROM routes r JOIN route_stops rs ON rs.route_id=r.id JOIN stations s ON s.id=rs.station_id WHERE r.id=? AND r.status='ACTIVE' AND s.is_active=0",
        [r.body.id],
      );
      expect(bad).toHaveLength(0);
    }
  });
  it('AC-3 serializes station deactivation against route creation and journey updates', async () => {
    for (const mode of ['create', 'update']) {
      const station = await mutate(admin, 'post', '/stations', {
        code: `${prefix}${mode}`,
        name: 'Bến kiểm tra ghi đồng thời',
        address: 'Test',
      }).expect(201);
      const existing = mode === 'update' ? await create() : null;
      const dto = existing?.data ?? body();
      dto.stops[1].station_id = station.body.id;
      const results = await Promise.all([
        existing
          ? mutate(admin, 'patch', `/routes/${existing.route.id}`, edit(dto))
          : mutate(admin, 'post', '/routes', dto),
        mutate(admin, 'patch', `/stations/${station.body.id}/status`, {
          is_active: false,
        }),
      ]);
      expect(results[0].status).toBeOneOf([mode === 'create' ? 201 : 200, 409]);
      expect(results[1].status).toBeOneOf([200, 409]);
      expect(results.some((result) => result.status === 409)).toBe(true);
      const [bad] = await db.query<RowDataPacket[]>(
        "SELECT r.id FROM routes r JOIN route_stops rs ON rs.route_id=r.id JOIN stations s ON s.id=rs.station_id WHERE s.id=? AND r.status='ACTIVE' AND s.is_active=0",
        [station.body.id],
      );
      expect(bad).toHaveLength(0);
    }
  });
  it('AC-3 concurrent duplicate inserts produce one route and one complete journey', async () => {
    const dto = body();
    const result = await Promise.all([
      mutate(admin, 'post', '/routes', dto),
      mutate(admin, 'post', '/routes', dto),
    ]);
    expect(result.map((r) => r.status).sort()).toEqual([201, 409]);
    const list = await admin.get('/routes').query({ search: dto.code });
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].stop_count).toBe(3);
  });
  it('AC-5 validates params/query and requires ADMIN plus request protection on every endpoint', async () => {
    const { route, data } = await create();
    for (const path of ['/routes', `/routes/${route.id}`]) {
      await request(url).get(path).expect(401);
      await user.get(path).expect(403);
    }
    for (const [method, path, dto] of [
      ['post', '/routes', data],
      ['patch', `/routes/${route.id}`, edit(data)],
      ['patch', `/routes/${route.id}/status`, { status: 'INACTIVE' }],
    ] as const) {
      await mutate(request.agent(url), method, path, dto).expect(401);
      await mutate(user, method, path, dto).expect(403);
      await admin[method](path).send(dto).expect(403);
    }
    for (const q of [
      'page=0',
      'page=1.5',
      'limit=101',
      'status=bad',
      'unknown=1',
      'page=1000001',
    ])
      await admin.get(`/routes?${q}`).expect(400);
    for (const id of ['0', '-1', 'abc', '18446744073709551616'])
      await admin.get(`/routes/${id}`).expect(400);
    await admin.get('/routes/18446744073709551615').expect(404);
    await mutate(
      admin,
      'patch',
      '/routes/18446744073709551615',
      edit(data),
    ).expect(404);
    await mutate(admin, 'patch', `/routes/${route.id}`, {
      ...edit(data),
      status: 'INACTIVE',
    }).expect(400);
  });
  it('AC-7 preserves legacy NULL minutes, rejects activation, and permits unchanged metadata', async () => {
    const { route, data } = await create({ status: 'INACTIVE' });
    await db.query(
      'UPDATE route_stops SET minutes_from_origin=NULL WHERE route_id=?',
      [route.id],
    );
    const legacy = edit(data);
    legacy.stops = legacy.stops.map((s) => ({
      ...s,
      minutes_from_origin: null,
    })) as typeof legacy.stops;
    await mutate(admin, 'patch', `/routes/${route.id}`, legacy).expect(200);
    await mutate(admin, 'patch', `/routes/${route.id}/status`, {
      status: 'ACTIVE',
    }).expect(400);
    await mutate(admin, 'patch', `/routes/${route.id}`, edit(data)).expect(200);
    await mutate(admin, 'patch', `/routes/${route.id}/status`, {
      status: 'ACTIVE',
    }).expect(200);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createHash, randomBytes } from 'node:crypto';
import mysql, {
  type Connection,
  type RowDataPacket,
  type ResultSetHeader,
} from 'mysql2/promise';
import request from 'supertest';
process.loadEnvFile('../.env');
const prefix = `SC${randomBytes(4).toString('hex')}`,
  url = 'http://127.0.0.1:3103';
let db: Connection,
  server: ChildProcess,
  admin: ReturnType<typeof request.agent>,
  user: ReturnType<typeof request.agent>,
  userId: string;
let stationIds: string[] = [];
let seq = 0;
const baseline: Record<string, { ids: string[]; hash: string }> = {};
const hash = (rows: unknown) =>
  createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const mutate = (
  agent: ReturnType<typeof request.agent>,
  method: 'post' | 'patch',
  path: string,
  body: unknown,
) => agent[method](path).set('X-GoBus-Request', '1').send(body);
async function vehicle() {
  const [v] = await db.query<ResultSetHeader>(
    'INSERT INTO vehicles(vehicle_code,capacity) VALUES (?,30)',
    [`${prefix}V${++seq}`],
  );
  return String(v.insertId);
}
async function route(extra: Record<string, unknown> = {}) {
  const payload = {
    code: `${prefix}R${++seq}`,
    name: `Tuyến kiểm thử ${prefix}`,
    origin_station_id: stationIds[0],
    destination_station_id: stationIds[2],
    operating_start: '00:00:00',
    operating_end: '23:59:59',
    distance_km: 10,
    status: 'ACTIVE',
    stops: stationIds.map((id, i) => ({
      station_id: id,
      stop_order: i + 1,
      minutes_from_origin: i * 10,
      km_from_origin: i * 5,
    })),
    ...extra,
  };
  const r = await mutate(admin, 'post', '/routes', payload).expect(201);
  return { payload, data: r.body };
}
async function body(extra: Record<string, unknown> = {}) {
  const r = await route();
  return {
    route_id: r.data.id,
    vehicle_id: await vehicle(),
    departure_at: '2099-01-01T01:00:00.000Z',
    arrival_at: '2099-01-01T01:20:00.000Z',
    ...extra,
  };
}
async function create(extra: Record<string, unknown> = {}) {
  const dto = await body(extra);
  const r = await mutate(admin, 'post', '/schedules', dto).expect(201);
  return { dto, data: r.body };
}
async function booking(id: string, status = 'CONFIRMED') {
  await db.query(
    `INSERT INTO bookings(booking_code,user_id,schedule_id,from_station_id,to_station_id,passenger_name,contact_phone,unit_price,status,cancelled_at) VALUES (?,?,?,?,?,'Kiểm thử lịch trình','0000000000',10000,?,${status === 'CANCELLED' ? 'UTC_TIMESTAMP(3)' : 'NULL'})`,
    [`${prefix}B${++seq}`, userId, id, stationIds[0], stationIds[2], status],
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
  for (const t of tables) {
    const name = String(Object.values(t)[0]);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM ?? ORDER BY id',
      [name],
    );
    baseline[name] = { ids: rows.map((r) => String(r.id)), hash: hash(rows) };
  }
  server = spawn(process.execPath, ['dist/main.js'], {
    env: {
      ...process.env,
      PORT: '3103',
      NODE_ENV: 'test',
      TZ: 'America/Los_Angeles',
    },
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
  if (!ready) throw Error('Test API failed to start');
  admin = request.agent(url);
  user = request.agent(url);
  await mutate(admin, 'post', '/auth/login', {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  }).expect(200);
  userId = (
    await mutate(user, 'post', '/auth/login', {
      email: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD,
    }).expect(200)
  ).body.id;
  for (let i = 0; i < 3; i++) {
    stationIds.push(
      (
        await mutate(admin, 'post', '/stations', {
          code: `${prefix}S${i}`,
          name: `Bến ${i}`,
          address: 'Kiểm thử',
        }).expect(201)
      ).body.id,
    );
  }
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
      await db.query('DELETE FROM vehicles WHERE vehicle_code LIKE ?', [
        `${prefix}%`,
      ]);
      await db.query('DELETE FROM stations WHERE code LIKE ?', [`${prefix}%`]);
      for (const [t, b] of Object.entries(baseline)) {
        if (!b.ids.length) continue;
        const [rows] = await db.query(
          'SELECT * FROM ?? WHERE id IN (?) ORDER BY id',
          [t, b.ids],
        );
        expect(hash(rows), `Preserve original ${t}`).toBe(b.hash);
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
describe('Schedules real MySQL, AC-1 through AC-7', { timeout: 30000 }, () => {
  it('AC-1 creates, reads UTC and per-stop times, searches, filters and paginates', async () => {
    const { dto, data } = await create();
    expect(data).toMatchObject({
      ...dto,
      status: 'SCHEDULED',
      capacity: 30,
      confirmed_bookings: 0,
      can_edit: true,
    });
    expect(
      data.stops.map((s: { expected_at: string }) => s.expected_at),
    ).toEqual([
      '2099-01-01T01:00:00.000Z',
      '2099-01-01T01:10:00.000Z',
      '2099-01-01T01:20:00.000Z',
    ]);
    const list = await admin
      .get('/schedules')
      .query({
        route_id: dto.route_id,
        status: 'SCHEDULED',
        search: prefix,
        limit: 1,
      })
      .expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].id).toBe(data.id);
    expect(
      (await admin.get('/schedules').query({ search: data.vehicle_code })).body
        .total,
    ).toBe(1);
    expect(
      (await admin.get('/schedules').query({ search: `${prefix}%_!` })).body
        .total,
    ).toBe(0);
    const vehicles = await admin
      .get('/schedules/vehicles')
      .query({ search: prefix, limit: 1 })
      .expect(200);
    expect(vehicles.body.items).toHaveLength(1);
    expect(typeof vehicles.body.items[0].id).toBe('string');
    const updated = await mutate(admin, 'patch', `/schedules/${data.id}`, {
      ...dto,
      departure_at: '2099-01-01T02:00:00Z',
      arrival_at: '2099-01-01T02:20:00Z',
    }).expect(200);
    expect(updated.body.departure_at).toBe('2099-01-01T02:00:00.000Z');
  });
  it('AC-1/2 uses inclusive Vietnamese days and excludes the next day boundary, independent of server TZ', async () => {
    const r = await route();
    const v = await vehicle();
    for (const start of [
      '2098-12-31T16:00:00.000Z',
      '2098-12-31T17:00:00.000Z',
      '2099-01-01T16:00:00.000Z',
      '2099-01-01T17:00:00.000Z',
    ])
      await mutate(admin, 'post', '/schedules', {
        route_id: r.data.id,
        vehicle_id: v,
        departure_at: start,
        arrival_at: new Date(Date.parse(start) + 20 * 60000).toISOString(),
      }).expect(201);
    const list = await admin
      .get('/schedules')
      .query({
        route_id: r.data.id,
        date_from: '2099-01-01',
        date_to: '2099-01-01',
      })
      .expect(200);
    expect(list.body.total).toBe(2);
    expect(
      list.body.items.map((s: { departure_at: string }) => s.departure_at),
    ).toEqual(['2099-01-01T16:00:00.000Z', '2098-12-31T17:00:00.000Z']);
  });
  it.each([
    'equal',
    'reverse',
    'duration',
    'overnight',
    'past',
    'invalid-date',
    'offset',
    'nozone',
    'milliseconds',
    'route-missing',
    'vehicle-missing',
    'bigint',
    'extra',
  ])('AC-2/5 rejects invalid %s input', async (kind) => {
    const dto: Record<string, unknown> = await body();
    let status = 400;
    if (kind === 'equal') dto.arrival_at = dto.departure_at;
    if (kind === 'reverse') dto.arrival_at = '2099-01-01T00:59:00Z';
    if (kind === 'duration') dto.arrival_at = '2099-01-01T01:21:00Z';
    if (kind === 'overnight') {
      dto.departure_at = '2099-01-01T16:50:00Z';
      dto.arrival_at = '2099-01-01T17:10:00Z';
    }
    if (kind === 'past') {
      dto.departure_at = '2000-01-01T01:00:00Z';
      dto.arrival_at = '2000-01-01T01:20:00Z';
      status = 409;
    }
    if (kind === 'invalid-date') dto.departure_at = '2099-02-30T01:00:00Z';
    if (kind === 'offset') dto.departure_at = '2099-01-01T08:00:00+07:00';
    if (kind === 'nozone') dto.departure_at = '2099-01-01T01:00:00';
    if (kind === 'milliseconds') dto.departure_at = '2099-01-01T01:00:00.0001Z';
    if (kind === 'route-missing') {
      dto.route_id = '18446744073709551615';
      status = 404;
    }
    if (kind === 'vehicle-missing') dto.vehicle_id = '18446744073709551615';
    if (kind === 'bigint') dto.vehicle_id = '18446744073709551616';
    if (kind === 'extra') dto.capacity = 99;
    await mutate(admin, 'post', '/schedules', dto).expect(status);
  });
  it('AC-2 rejects outside route hours, accepts exact boundary, blocks missing minutes/inactive route/station', async () => {
    const r = await route({
      operating_start: '08:00:00',
      operating_end: '08:20:00',
    });
    const dto = await body({ route_id: r.data.id });
    const created = await mutate(admin, 'post', '/schedules', dto).expect(201);
    await mutate(admin, 'patch', `/schedules/${created.body.id}`, {
      ...dto,
      departure_at: '2099-01-01T00:59:00Z',
      arrival_at: '2099-01-01T01:19:00Z',
    }).expect(400);
    await db.query(
      'UPDATE route_stops SET minutes_from_origin=NULL WHERE route_id=?',
      [dto.route_id],
    );
    await mutate(admin, 'post', '/schedules', {
      ...dto,
      vehicle_id: await vehicle(),
    }).expect(400);
    expect(
      (await admin.get(`/schedules/${created.body.id}`)).body.stops[0]
        .expected_at,
    ).toBeNull();
    const inactive = await route({ status: 'INACTIVE' });
    await mutate(admin, 'post', '/schedules', {
      ...dto,
      route_id: inactive.data.id,
    }).expect(409);
    const broken = await route();
    await db.query('UPDATE stations SET is_active=0 WHERE id=?', [
      stationIds[1],
    ]);
    try {
      await mutate(admin, 'post', '/schedules', {
        ...dto,
        route_id: broken.data.id,
      }).expect(409);
    } finally {
      await db.query('UPDATE stations SET is_active=1 WHERE id=?', [
        stationIds[1],
      ]);
    }
  });
  it.each([
    ['overlap', '01:10', '01:30'],
    ['inside', '01:05', '01:15'],
    ['contains', '00:50', '01:30'],
    ['same', '01:00', '01:20'],
  ])('AC-3 blocks %s intervals', async (_, start, end) => {
    const { dto } = await create();
    const duration =
      (Date.parse(`2099-01-01T${end}:00Z`) -
        Date.parse(`2099-01-01T${start}:00Z`)) /
      60000;
    const r = await route({
      stops: stationIds.map((id, i) => ({
        station_id: id,
        stop_order: i + 1,
        km_from_origin: i * 5,
        minutes_from_origin: (i * duration) / 2,
      })),
    });
    await mutate(admin, 'post', '/schedules', {
      ...dto,
      route_id: r.data.id,
      departure_at: `2099-01-01T${start}:00Z`,
      arrival_at: `2099-01-01T${end}:00Z`,
    }).expect(409);
  });
  it('AC-3 allows adjacent intervals and separate vehicles, rejects a conflicting move without changing original', async () => {
    const { dto, data } = await create();
    const adjacent = {
      ...dto,
      departure_at: '2099-01-01T01:20:00Z',
      arrival_at: '2099-01-01T01:40:00Z',
    };
    await mutate(admin, 'post', '/schedules', adjacent).expect(201);
    const other = await create();
    await mutate(admin, 'patch', `/schedules/${other.data.id}`, {
      ...other.dto,
      vehicle_id: dto.vehicle_id,
    }).expect(409);
    expect(
      (await admin.get(`/schedules/${other.data.id}`)).body.vehicle_id,
    ).toBe(other.dto.vehicle_id);
    await mutate(admin, 'patch', `/schedules/${data.id}/status`, {
      status: 'CANCELLED',
    }).expect(200);
    await mutate(admin, 'post', '/schedules', dto).expect(409); // unique pair retained even on cancelled rows
    await mutate(admin, 'post', '/schedules', {
      ...dto,
      departure_at: '2099-01-01T00:59:00Z',
      arrival_at: '2099-01-01T01:19:00Z',
    }).expect(201);
  });
  it.each(['CONFIRMED', 'CANCELLED'])(
    'AC-4 preserves history for %s tickets',
    async (status) => {
      const { dto, data } = await create();
      await booking(data.id, status);
      for (const patch of [
        { route_id: (await route()).data.id },
        { vehicle_id: await vehicle() },
        {
          departure_at: '2099-01-01T02:00:00Z',
          arrival_at: '2099-01-01T02:20:00Z',
        },
      ])
        await mutate(admin, 'patch', `/schedules/${data.id}`, {
          ...dto,
          ...patch,
        }).expect(409);
      const detail = await admin.get(`/schedules/${data.id}`);
      expect(detail.body.can_edit).toBe(false);
      expect(detail.body.has_bookings).toBe(true);
      await mutate(admin, 'patch', `/schedules/${data.id}/status`, {
        status: 'CANCELLED',
      }).expect(status === 'CONFIRMED' ? 409 : 200);
      const [rows] = await db.query<RowDataPacket[]>(
        'SELECT status FROM bookings WHERE schedule_id=?',
        [data.id],
      );
      expect(rows[0].status).toBe(status);
    },
  );
  it('AC-4 enforces state machine, time gates and terminal states', async () => {
    const { data, dto } = await create();
    for (const status of ['COMPLETED', 'DEPARTED'])
      await mutate(admin, 'patch', `/schedules/${data.id}/status`, {
        status,
      }).expect(409);
    await mutate(admin, 'patch', `/schedules/${data.id}/status`, {
      status: 'SCHEDULED',
    }).expect(400);
    await mutate(admin, 'patch', `/schedules/${data.id}/status`, {
      status: 'CANCELLED',
    }).expect(200);
    await mutate(admin, 'patch', `/schedules/${data.id}/status`, {
      status: 'CANCELLED',
    }).expect(409);
    await mutate(admin, 'patch', `/schedules/${data.id}`, dto).expect(409);
    const completed = await create();
    await db.query(
      "UPDATE schedules SET status='DEPARTED',departure_at='2000-01-01 01:00:00',arrival_at='2000-01-01 01:20:00' WHERE id=?",
      [completed.data.id],
    );
    await mutate(admin, 'patch', `/schedules/${completed.data.id}/status`, {
      status: 'COMPLETED',
    }).expect(200);
    await mutate(admin, 'patch', `/schedules/${completed.data.id}/status`, {
      status: 'DEPARTED',
    }).expect(409);
    const early = await create();
    await db.query("UPDATE schedules SET status='DEPARTED' WHERE id=?", [
      early.data.id,
    ]);
    await mutate(admin, 'patch', `/schedules/${early.data.id}/status`, {
      status: 'COMPLETED',
    }).expect(409);
    const past = await create();
    await db.query(
      "UPDATE schedules SET departure_at='2000-01-01 01:00:00',arrival_at='2000-01-01 01:20:00' WHERE id=?",
      [past.data.id],
    );
    await mutate(admin, 'patch', `/schedules/${past.data.id}`, past.dto).expect(
      409,
    );
  });
  it('AC-2/4 rechecks an inactive route at departure and permits a valid booked departure', async () => {
    const { data } = await create();
    const [clock] = await db.query<RowDataPacket[]>(
      "SELECT DATE_FORMAT(UTC_TIMESTAMP(3),'%Y-%m-%dT%H:%i:%s.%fZ') AS now",
    );
    const now = Date.parse(clock[0].now);
    const localDay = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
    const dayStart = Date.parse(`${localDay}T00:00:00+07:00`);
    const departure = Math.max(
      dayStart,
      Math.min(now - 60000, dayStart + 86400000 - 1200001),
    );
    const sql = (n: number) =>
      new Date(n).toISOString().replace('T', ' ').replace('Z', '');
    await db.query(
      'UPDATE schedules SET departure_at=?,arrival_at=? WHERE id=?',
      [sql(departure), sql(departure + 1200000), data.id],
    );
    await mutate(admin, 'patch', `/routes/${data.route_id}/status`, {
      status: 'INACTIVE',
    }).expect(200);
    await mutate(admin, 'patch', `/schedules/${data.id}/status`, {
      status: 'DEPARTED',
    }).expect(409);
    await mutate(admin, 'patch', `/routes/${data.route_id}/status`, {
      status: 'ACTIVE',
    }).expect(200);
    await booking(data.id);
    const departed = await mutate(
      admin,
      'patch',
      `/schedules/${data.id}/status`,
      { status: 'DEPARTED' },
    ).expect(200);
    expect(departed.body.status).toBe('DEPARTED');
    expect(departed.body.confirmed_bookings).toBe(1);
    await mutate(admin, 'patch', `/schedules/${data.id}/status`, {
      status: 'DEPARTED',
    }).expect(409);
  });
  it('AC-1/3 permits changing both route and vehicle when compatible', async () => {
    const { data, dto } = await create();
    const nextRoute = await route(),
      nextVehicle = await vehicle();
    const moved = await mutate(admin, 'patch', `/schedules/${data.id}`, {
      ...dto,
      route_id: nextRoute.data.id,
      vehicle_id: nextVehicle,
    }).expect(200);
    expect(moved.body.route_id).toBe(nextRoute.data.id);
    expect(moved.body.vehicle_id).toBe(nextVehicle);
    expect(moved.body.id).toBe(data.id);
  });
  it('AC-3 serializes concurrent creates across different routes on one vehicle', async () => {
    const a = await body(),
      b = await body({ vehicle_id: a.vehicle_id });
    const res = await Promise.all([
      mutate(admin, 'post', '/schedules', a),
      mutate(admin, 'post', '/schedules', b),
    ]);
    expect(res.map((r) => r.status).sort()).toEqual([201, 409]);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM schedules WHERE vehicle_id=?',
      [a.vehicle_id],
    );
    expect(rows).toHaveLength(1);
  });
  it('AC-3 serializes concurrent moves to one vehicle and rolls back loser', async () => {
    const a = await create(),
      b = await create(),
      v = await vehicle();
    const res = await Promise.all([
      mutate(admin, 'patch', `/schedules/${a.data.id}`, {
        ...a.dto,
        vehicle_id: v,
      }),
      mutate(admin, 'patch', `/schedules/${b.data.id}`, {
        ...b.dto,
        vehicle_id: v,
      }),
    ]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM schedules WHERE vehicle_id=?',
      [v],
    );
    expect(rows).toHaveLength(1);
  });
  it('AC-3/5 coordinates create with route hours/status and station retirement', async () => {
    const r = await route();
    const dto = await body({ route_id: r.data.id });
    const { status: _status, ...edit } = r.payload;
    const res = await Promise.all([
      mutate(admin, 'post', '/schedules', dto),
      mutate(admin, 'patch', `/routes/${r.data.id}`, {
        ...edit,
        operating_start: '10:00:00',
      }),
    ]);
    expect(res[0].status).toBeOneOf([201, 400]);
    expect(res[1].status).toBeOneOf([200, 409]);
    expect(res.filter((r) => r.status >= 400)).toHaveLength(1);
    const d = await body();
    const statusRace = await Promise.all([
      mutate(admin, 'post', '/schedules', d),
      mutate(admin, 'patch', `/routes/${d.route_id}/status`, {
        status: 'INACTIVE',
      }),
    ]);
    expect(statusRace[0].status).toBeOneOf([201, 409]);
    expect(statusRace[1].status).toBe(200);
    const stationRace = await Promise.all([
      mutate(admin, 'post', '/schedules', await body()),
      mutate(admin, 'patch', `/stations/${stationIds[1]}/status`, {
        is_active: false,
      }),
    ]);
    expect(stationRace.map((r) => r.status)).toEqual([201, 409]);
  });
  it('AC-4 serializes duplicate status transitions', async () => {
    const { data } = await create();
    const res = await Promise.all([
      mutate(admin, 'patch', `/schedules/${data.id}/status`, {
        status: 'CANCELLED',
      }),
      mutate(admin, 'patch', `/schedules/${data.id}/status`, {
        status: 'CANCELLED',
      }),
    ]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
  });
  it('AC-5 validates queries/IDs, enforces ADMIN and request protection on every API', async () => {
    const { data, dto } = await create();
    for (const path of [
      '/schedules',
      '/schedules/vehicles',
      `/schedules/${data.id}`,
    ]) {
      await request(url).get(path).expect(401);
      await user.get(path).expect(403);
    }
    for (const [method, path, value] of [
      ['post', '/schedules', dto],
      ['patch', `/schedules/${data.id}`, dto],
      ['patch', `/schedules/${data.id}/status`, { status: 'CANCELLED' }],
    ] as const) {
      await mutate(request.agent(url), method, path, value).expect(401);
      await mutate(user, method, path, value).expect(403);
      await admin[method](path).send(value).expect(403);
    }
    for (const q of [
      'page=0',
      'limit=101',
      'status=bad',
      'date_from=2099-02-30',
      'date_to=not-a-date',
      'date_from=2099-01-02&date_to=2099-01-01',
      'route_id=18446744073709551616',
      'unknown=1',
    ])
      await admin.get(`/schedules?${q}`).expect(400);
    for (const id of ['0', '-1', 'abc', '18446744073709551616'])
      await admin.get(`/schedules/${id}`).expect(400);
    await admin.get('/schedules/18446744073709551615').expect(404);
    await mutate(admin, 'patch', '/schedules/18446744073709551615', dto).expect(
      404,
    );
  });
});

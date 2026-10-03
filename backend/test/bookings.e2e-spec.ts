import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { hash } from 'bcryptjs';
import request from 'supertest';

process.loadEnvFile('../.env');
const prefix = `BK${randomBytes(4).toString('hex')}`;
const url = 'http://127.0.0.1:3105';
const date = '2090-10-12';
let server: ChildProcess;
let db: Connection;
let member: ReturnType<typeof request.agent>;
let other: ReturnType<typeof request.agent>;
let ownerId: string, routeId: string, vehicleId: string;
const stations: string[] = [];
const baseline: Record<string, string> = {};
const digest = (rows: unknown) =>
  createHash('sha256').update(JSON.stringify(rows)).digest('hex');
async function insert(sql: string, values: unknown[]) {
  await db.query(sql, values);
  const [rows] = await db.query<RowDataPacket[]>(
    'SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id',
  );
  return rows[0].id as string;
}
async function newSchedule(hour: number) {
  return insert(
    'INSERT INTO schedules(route_id,vehicle_id,departure_at,arrival_at) VALUES(?,?,?,?)',
    [
      routeId,
      vehicleId,
      `${date} ${String(hour).padStart(2, '0')}:00:00`,
      `${date} ${String(hour).padStart(2, '0')}:20:00`,
    ],
  );
}
function payload(scheduleId: string, from = 0, to = 2, quantity = 1) {
  return {
    schedule_id: scheduleId,
    from_station_id: stations[from],
    to_station_id: stations[to],
    unit_price: 4000 + 500 * (to - from) * 5,
    request_id: randomUUID(),
    passengers: Array.from({ length: quantity }, (_, index) => ({
      passenger_name: `Hành khách ${index + 1}`,
      contact_phone: '0901234567',
    })),
  };
}
const create = (body: ReturnType<typeof payload>) =>
  member.post('/bookings').set('X-GoBus-Request', '1').send(body);
const quote = (scheduleId: string, from = 0, to = 2) =>
  member
    .get(`/bookings/trips/${scheduleId}`)
    .query({ from_station_id: stations[from], to_station_id: stations[to] });

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
    const [rows] = await db.query('SELECT * FROM ?? ORDER BY id', [table]);
    baseline[table] = digest(rows);
  }
  const password = randomBytes(16).toString('hex');
  ownerId = await insert(
    'INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,?)',
    [prefix, `${prefix}@example.test`, await hash(password, 4), 'USER'],
  );
  for (let i = 0; i < 3; i++)
    stations.push(
      await insert('INSERT INTO stations(code,name,address) VALUES(?,?,?)', [
        `${prefix}S${i}`,
        `${prefix} Bến ${i}`,
        'Kiểm thử đặt vé',
      ]),
    );
  routeId = await insert(
    `INSERT INTO routes(code,name,origin_station_id,destination_station_id,
    operating_start,operating_end,distance_km) VALUES(?,?,?,?,?,?,?)`,
    [prefix, prefix, stations[0], stations[2], '00:00:00', '23:59:00', 10],
  );
  for (let i = 0; i < 3; i++)
    await db.query(
      `INSERT INTO route_stops(route_id,station_id,stop_order,km_from_origin,minutes_from_origin)
    VALUES(?,?,?,?,?)`,
      [routeId, stations[i], i + 1, i * 5, i * 10],
    );
  vehicleId = await insert(
    'INSERT INTO vehicles(vehicle_code,capacity) VALUES(?,2)',
    [prefix],
  );
  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: '3105', NODE_ENV: 'test' },
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
  if (!ready) throw new Error('Booking test API did not start');
  member = request.agent(url);
  other = request.agent(url);
  await member
    .post('/auth/login')
    .set('X-GoBus-Request', '1')
    .send({ email: `${prefix}@example.test`, password })
    .expect(200);
  await other
    .post('/auth/login')
    .set('X-GoBus-Request', '1')
    .send({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    })
    .expect(200);
}, 20000);

afterAll(async () => {
  try {
    if (db) {
      if (routeId) {
        await db.query(
          'DELETE b FROM bookings b JOIN schedules s ON s.id=b.schedule_id WHERE s.route_id=?',
          [routeId],
        );
        await db.query('DELETE FROM schedules WHERE route_id=?', [routeId]);
        await db.query('DELETE FROM route_stops WHERE route_id=?', [routeId]);
        await db.query('DELETE FROM routes WHERE id=?', [routeId]);
      }
      if (vehicleId)
        await db.query('DELETE FROM vehicles WHERE id=?', [vehicleId]);
      for (const id of stations)
        await db.query('DELETE FROM stations WHERE id=?', [id]);
      if (ownerId) await db.query('DELETE FROM users WHERE id=?', [ownerId]);
      for (const [table, expected] of Object.entries(baseline)) {
        const [rows] = await db.query('SELECT * FROM ?? ORDER BY id', [table]);
        expect(digest(rows), `Original data in ${table} preserved`).toBe(
          expected,
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

describe('Passenger booking flow with real MySQL', () => {
  it('AC-7 requires a session and the existing CSRF header', async () => {
    await request(url).get('/bookings').expect(401);
    await request(url).get('/bookings/trips').expect(401);
    await member.post('/bookings').send({}).expect(403);
  });
  it('AC-1 searches the pickup day in Vietnam and computes segment price', async () => {
    const id = await newSchedule(17); // Midnight the following day in Vietnam.
    const search = {
      from_station_id: stations[1],
      to_station_id: stations[2],
      route_id: routeId,
    };
    const previous = await member
      .get('/bookings/trips')
      .query({ ...search, date })
      .expect(200);
    expect(previous.body.total).toBe(0);
    const next = await member
      .get('/bookings/trips')
      .query({ ...search, date: '2090-10-13', limit: 1 })
      .expect(200);
    expect(next.body.items[0]).toMatchObject({
      id,
      unit_price: 6500,
      remaining: 2,
      pickup_at: '2090-10-12T17:10:00.000000Z',
    });
    await member
      .get('/bookings/trips')
      .query({ ...search, date: '2090-02-30' })
      .expect(400);
    await quote(id, 2, 0).expect(404);
  });
  it('AC-2, AC-3 and AC-4 save each passenger and replay a request without duplicates', async () => {
    const id = await newSchedule(1),
      body = payload(id, 0, 2, 2);
    body.passengers[0].passenger_name = '  Nguyễn An  ';
    body.passengers[1] = {
      passenger_name: 'Trần Bình',
      contact_phone: '+84 901 234 567',
    };
    const result = await create(body).expect(201);
    expect(result.body.ids).toHaveLength(2);
    expect(result.body.total_price).toBe(18000);
    expect((await create(body).expect(201)).body).toEqual(result.body);
    const receipt = await member
      .get(`/bookings/receipt/${body.request_id}`)
      .expect(200);
    expect(
      receipt.body.map((t: { passenger_name: string }) => t.passenger_name),
    ).toEqual(['Nguyễn An', 'Trần Bình']);
    expect(
      receipt.body.every(
        (t: { booking_code: string }) => t.booking_code.length === 24,
      ),
    ).toBe(true);
    const detail = await member
      .get(`/bookings/${result.body.ids[0]}`)
      .expect(200);
    expect(detail.body.qr_data_url).toMatch(/^data:image\/png;base64,/);
    expect(detail.body).not.toHaveProperty('password_hash');
    await create({
      ...body,
      passengers: [{ passenger_name: 'Khác', contact_phone: '0901234567' }],
    }).expect(409);
  });
  it('AC-3 counts overlapping segments and reuses a seat on a separate segment', async () => {
    const id = await newSchedule(2);
    await create(payload(id, 0, 1, 2)).expect(201);
    expect((await quote(id).expect(200)).body.remaining).toBe(0);
    expect((await quote(id, 1, 2).expect(200)).body.remaining).toBe(2);
    await create(payload(id, 1, 2, 2)).expect(201);
    await create(payload(id)).expect(409);
  });
  it('AC-3 serializes simultaneous requests without overselling', async () => {
    const id = await newSchedule(3);
    const results = await Promise.all([
      create(payload(id, 0, 2, 2)),
      create(payload(id, 0, 2, 2)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) n FROM bookings WHERE schedule_id=?',
      [id],
    );
    expect(Number(rows[0].n)).toBe(2);
  });
  it('AC-3 rejects stale prices and invalid passenger data without writing partial tickets', async () => {
    const id = await newSchedule(4),
      body = payload(id);
    await create({ ...body, unit_price: 1 }).expect(409);
    for (const passengers of [
      [],
      [{ passenger_name: ' ', contact_phone: '0901234567' }],
      [{ passenger_name: 'An', contact_phone: '--------' }],
      [{ passenger_name: 'An', contact_phone: '0901234567', user_id: '1' }],
    ])
      await create({ ...body, passengers } as ReturnType<
        typeof payload
      >).expect(400);
    await create({ ...body, from_station_id: '18446744073709551616' }).expect(
      400,
    );
    await create(payload(id, 0, 2, 3)).expect(409);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) n FROM bookings WHERE schedule_id=?',
      [id],
    );
    expect(Number(rows[0].n)).toBe(0);
  });
  it('AC-5, AC-6 and AC-7 isolate ownership, retain cancelled tickets and release capacity', async () => {
    const id = await newSchedule(5),
      body = payload(id);
    const result = await create(body).expect(201),
      ticketId = result.body.ids[0];
    await other.get(`/bookings/${ticketId}`).expect(404);
    await other.get(`/bookings/receipt/${body.request_id}`).expect(404);
    await other
      .patch(`/bookings/${ticketId}/cancel`)
      .set('X-GoBus-Request', '1')
      .expect(404);
    const cancel = await member
      .patch(`/bookings/${ticketId}/cancel`)
      .set('X-GoBus-Request', '1')
      .expect(200);
    expect(cancel.body).toMatchObject({
      status: 'CANCELLED',
      display_status: 'CANCELLED',
      can_cancel: false,
    });
    expect(cancel.body.cancelled_at).toBeTruthy();
    expect((await quote(id).expect(200)).body.remaining).toBe(2);
    expect(
      (
        await member
          .patch(`/bookings/${ticketId}/cancel`)
          .set('X-GoBus-Request', '1')
          .expect(200)
      ).body.cancelled_at,
    ).toBe(cancel.body.cancelled_at);
    const list = await member
      .get('/bookings')
      .query({ filter: 'CANCELLED' })
      .expect(200);
    expect(list.body.items.map((t: { id: string }) => t.id)).toContain(
      ticketId,
    );
    const active = await member
      .get('/bookings')
      .query({ filter: 'CONFIRMED' })
      .expect(200);
    expect(active.body.items.map((t: { id: string }) => t.id)).not.toContain(
      ticketId,
    );
  });
  it('AC-7 closes booking for unavailable trips and cancellation after pickup', async () => {
    const id = await newSchedule(6),
      body = payload(id);
    const result = await create(body).expect(201),
      ticketId = result.body.ids[0];
    await db.query(
      "UPDATE schedules SET departure_at='2020-01-01 00:00:00',arrival_at='2020-01-01 00:20:00',status='COMPLETED' WHERE id=?",
      [id],
    );
    await quote(id).expect(404);
    await create({ ...body, request_id: randomUUID() }).expect(409);
    await member
      .patch(`/bookings/${ticketId}/cancel`)
      .set('X-GoBus-Request', '1')
      .expect(409);
    const list = await member
      .get('/bookings')
      .query({ filter: 'COMPLETED' })
      .expect(200);
    expect(list.body.items.map((t: { id: string }) => t.id)).toContain(
      ticketId,
    );
    const next = await newSchedule(7);
    await db.query('UPDATE stations SET is_active=0 WHERE id=?', [stations[1]]);
    try {
      await quote(next).expect(404);
      await create(payload(next)).expect(404);
    } finally {
      await db.query('UPDATE stations SET is_active=1 WHERE id=?', [
        stations[1],
      ]);
    }
  });
});

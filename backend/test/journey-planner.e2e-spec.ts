import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import request from 'supertest';

process.loadEnvFile('../.env');
const prefix = `JP${randomBytes(4).toString('hex')}`;
const url = 'http://127.0.0.1:3105';
let server: ChildProcess;
let db: Connection;
let user: ReturnType<typeof request.agent>;
let admin: ReturnType<typeof request.agent>;
const snapshot: Record<string, string> = {};
const testNow = Date.parse('2035-01-01T01:00:00Z');
const stationIds: Record<string, string> = {};
const routeIds: Record<string, string> = {};
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
  for (const table of tables) {
    const name = String(Object.values(table)[0]);
    const [rows] = await db.query('SELECT * FROM ?? ORDER BY id', [name]);
    snapshot[name] = digest(rows);
  }
  for (const [suffix, name, active, located] of [
    ['A', 'Bến Tràng Thi', 1, true],
    ['B', 'Bến Tràng Thi mở rộng', 1, true],
    ['C', 'Bến ký tự %_!', 1, true],
    ['D', 'Bến Tràng Thi ngừng', 0, true],
    ['E', 'Bến Tràng Thi thiếu tọa độ', 1, false],
  ] as const) {
    await db.query(
      'INSERT INTO stations(code,name,address,is_active,latitude,longitude) VALUES (?,?,?,?,?,?)',
      [
        `${prefix}${suffix}`,
        `${name} ${prefix}`,
        `Địa chỉ ${prefix} Hà Nội`,
        active,
        located ? 21.02655 : null,
        located ? 105.84968 : null,
      ],
    );
  }
  const [stations] = await db.query<RowDataPacket[]>(
    'SELECT CAST(id AS CHAR) AS id,code FROM stations WHERE code LIKE ?',
    [`${prefix}%`],
  );
  for (const station of stations)
    stationIds[String(station.code).slice(prefix.length)] = String(station.id);
  await db.query('UPDATE stations SET latitude=21.02705 WHERE id=?', [
    stationIds.B,
  ]);
  await db.query('UPDATE stations SET latitude=21.05 WHERE id=?', [
    stationIds.C,
  ]);
  await db.query('INSERT INTO vehicles(vehicle_code,capacity) VALUES (?,40)', [
    prefix,
  ]);
  const [[vehicle]] = await db.query<RowDataPacket[]>(
    'SELECT id FROM vehicles WHERE vehicle_code=?',
    [prefix],
  );
  for (const [suffix, status] of [
    ['FAST', 'ACTIVE'],
    ['SLOW', 'ACTIVE'],
    ['OFF', 'INACTIVE'],
    ['REVERSE', 'ACTIVE'],
    ['CANCEL', 'ACTIVE'],
    ['LEGACY', 'ACTIVE'],
    ['TOMORROW', 'ACTIVE'],
  ] as const) {
    const reverse = suffix === 'REVERSE';
    await db.query(
      `INSERT INTO routes(code,name,origin_station_id,destination_station_id,operating_start,operating_end,distance_km,status)
      VALUES (?,?,?,?,'05:00:00','22:00:00',6,?)`,
      [
        `${prefix}${suffix}`,
        `Tuyến ${suffix}`,
        stationIds[reverse ? 'C' : 'A'],
        stationIds[reverse ? 'A' : 'C'],
        status,
      ],
    );
    const [[route]] = await db.query<RowDataPacket[]>(
      'SELECT CAST(id AS CHAR) AS id FROM routes WHERE code=?',
      [`${prefix}${suffix}`],
    );
    routeIds[suffix] = String(route.id);
    const order = reverse ? ['C', 'B', 'A'] : ['A', 'B', 'C'];
    for (let i = 0; i < 3; i++)
      await db.query(
        'INSERT INTO route_stops(route_id,station_id,stop_order,km_from_origin,minutes_from_origin) VALUES (?,?,?,?,?)',
        [
          route.id,
          stationIds[order[i]],
          i + 1,
          [0, 2, 6][i],
          suffix === 'LEGACY' ? null : [0, 8, 20][i],
        ],
      );
    const minutes =
      suffix === 'FAST'
        ? -3
        : suffix === 'SLOW'
          ? 10
          : suffix === 'TOMORROW'
            ? 1440
            : 30 + Object.keys(routeIds).length;
    await db.query(
      'INSERT INTO schedules(route_id,departure_at,arrival_at,vehicle_id,status) VALUES (?,?,?,?,?)',
      [
        route.id,
        new Date(testNow + minutes * 60000)
          .toISOString()
          .slice(0, 23)
          .replace('T', ' '),
        new Date(testNow + (minutes + 20) * 60000)
          .toISOString()
          .slice(0, 23)
          .replace('T', ' '),
        vehicle.id,
        suffix === 'CANCEL'
          ? 'CANCELLED'
          : suffix === 'FAST'
            ? 'DEPARTED'
            : 'SCHEDULED',
      ],
    );
  }
  // Freeze this test server only and stub its external routing/geocoding boundaries.
  // MySQL, HTTP validation, sessions and cache writes remain real.
  const testBootstrap = `Date.now=()=>${testNow};
    const realFetch=globalThis.fetch;
    globalThis.fetch=(input,options)=>{
      const url=String(input);
      if(url.startsWith('https://nominatim.openstreetmap.org/')) {
        if(new URL(url).searchParams.get('q').includes('outage')) return Promise.reject(new Error('Simulated geocoding outage'));
        return Promise.resolve({ok:true,json:async()=>[{display_name:'Ho Guom, Ha Noi',lat:'21.028',lon:'105.852'}]});
      }
      if(!url.startsWith('https://router.project-osrm.org/'))return realFetch(input,options);
      if(url.includes('105.84969,'))return Promise.reject(new Error('Simulated OSRM outage'));
      const points=new URL(url).pathname.split('/').at(-1).split(';').map(p=>p.split(',').map(Number));
      const legs=points.slice(1).map((point,i)=>({steps:[{geometry:{type:'LineString',coordinates:[points[i],[(points[i][0]+point[0])/2+0.00001,(points[i][1]+point[1])/2],point]}}]}));
      return Promise.resolve({ok:true,json:async()=>({code:'Ok',routes:[{legs}]})});
    };`;
  server = spawn(
    process.execPath,
    [
      '--import',
      `data:text/javascript,${encodeURIComponent(testBootstrap)}`,
      'dist/main.js',
    ],
    {
      env: { ...process.env, PORT: '3105', NODE_ENV: 'test' },
      stdio: 'ignore',
    },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      ready = (await fetch(url)).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Journey planner test API did not start');
  user = request.agent(url);
  admin = request.agent(url);
  await login(
    user,
    process.env.TEST_USER_EMAIL,
    process.env.TEST_USER_PASSWORD,
  ).expect(200);
  await login(
    admin,
    process.env.TEST_ADMIN_EMAIL,
    process.env.TEST_ADMIN_PASSWORD,
  ).expect(200);
}, 20000);

afterAll(async () => {
  try {
    if (db) {
      await db.query(
        'DELETE sc FROM schedules sc JOIN routes r ON r.id=sc.route_id WHERE r.code LIKE ?',
        [`${prefix}%`],
      );
      await db.query(
        'DELETE rs FROM route_stops rs JOIN routes r ON r.id=rs.route_id WHERE r.code LIKE ?',
        [`${prefix}%`],
      );
      await db.query('DELETE FROM routes WHERE code LIKE ?', [`${prefix}%`]);
      await db.query('DELETE FROM vehicles WHERE vehicle_code=?', [prefix]);
      await db.query('DELETE FROM stations WHERE code LIKE ?', [`${prefix}%`]);
      for (const [name, hash] of Object.entries(snapshot)) {
        const [rows] = await db.query('SELECT * FROM ?? ORDER BY id', [name]);
        expect(digest(rows), `Original ${name} rows preserved`).toBe(hash);
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

describe('Journey planner place autocomplete, real MySQL', () => {
  it('requires a session and supports USER and ADMIN without admin data', async () => {
    await request(url)
      .get('/journey-planner/places')
      .query({ search: prefix })
      .expect(401);
    const response = await user
      .get('/journey-planner/places')
      .query({ search: prefix })
      .expect(200);
    expect(response.body.total).toBe(3);
    expect(Object.keys(response.body.items[0]).sort()).toEqual([
      'address',
      'code',
      'id',
      'latitude',
      'longitude',
      'name',
    ]);
    expect(typeof response.body.items[0].id).toBe('string');
    expect(
      response.body.items.find(
        (item: { code: string }) => item.code === `${prefix}A`,
      ).latitude,
    ).toBe(21.02655);
    expect(response.body.items[0].longitude).toBe(105.84968);
    await admin
      .get('/journey-planner/places')
      .query({ search: prefix })
      .expect(200);
    await user.get('/stations').expect(403);
  });
  it('matches case, unaccented Vietnamese, code, partial names and addresses', async () => {
    const search = (term: string) =>
      user.get('/journey-planner/places').query({ search: term }).expect(200);
    const mixed = await search(`bẾn tRÀng tHI ${prefix}`);
    const upper = await search(`BẾN TRÀNG THI ${prefix}`);
    const plain = await search(`ben trang thi ${prefix}`);
    expect(mixed.body.items).toEqual(upper.body.items);
    expect(plain.body.items).toEqual(upper.body.items);
    expect(mixed.body.items[0].code).toBe(`${prefix}A`);
    const code = await search(`  ${prefix.toLowerCase()}a  `);
    expect(code.body.items[0].code).toBe(`${prefix}A`);
    const address = await search(`dia chi ${prefix}`);
    expect(address.body.total).toBe(3);
  });
  it('hides inactive and unlocated stations and returns stable pages', async () => {
    const first = await user
      .get('/journey-planner/places')
      .query({ search: prefix, limit: 2 })
      .expect(200);
    const second = await user
      .get('/journey-planner/places')
      .query({ search: prefix, limit: 2, page: 2 })
      .expect(200);
    expect(first.body).toMatchObject({
      total: 3,
      page: 1,
      limit: 2,
      totalPages: 2,
    });
    const codes = [...first.body.items, ...second.body.items].map(
      (place: { code: string }) => place.code,
    );
    expect(codes.sort()).toEqual([`${prefix}A`, `${prefix}B`, `${prefix}C`]);
    const exact = await user
      .get('/journey-planner/places')
      .query({ search: `${prefix}B` })
      .expect(200);
    expect(exact.body.items[0].code).toBe(`${prefix}B`);
  });
  it('treats wildcards and SQL-looking input literally', async () => {
    const literal = await user
      .get('/journey-planner/places')
      .query({ search: `%_! ${prefix}` })
      .expect(200);
    expect(
      literal.body.items.map((place: { code: string }) => place.code),
    ).toEqual([`${prefix}C`]);
    const injection = await user
      .get('/journey-planner/places')
      .query({ search: `' OR 1=1 -- ${prefix}` })
      .expect(200);
    expect(injection.body.items).toEqual([]);
  });
  it('returns an empty dropdown for blank or unmatched input', async () => {
    for (const search of ['', '   ', `${prefix}not-found`]) {
      const response = await user
        .get('/journey-planner/places')
        .query({ search })
        .expect(200);
      expect(response.body).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 8,
        totalPages: 0,
      });
    }
  });
  it('validates limits, length, arrays and unexpected query parameters', async () => {
    for (const query of [
      { limit: 0 },
      { limit: 21 },
      { limit: '1.5' },
      { page: 0 },
      { page: 1000001 },
      { search: 'x'.repeat(256) },
      { search: ['a', 'b'] },
      { is_active: 0 },
    ])
      await user.get('/journey-planner/places').query(query).expect(400);
  });
  it('rejects requests after logout', async () => {
    await user.post('/auth/logout').set('X-GoBus-Request', '1').expect(200);
    await user
      .get('/journey-planner/places')
      .query({ search: prefix })
      .expect(401);
  });
});

describe('Journey recommendations, real MySQL', () => {
  const search = (extra = {}) =>
    admin.get('/journey-planner/journeys').query({
      latitude: 21.02755,
      longitude: 105.84968,
      destination_station_id: stationIds.C,
      ...extra,
    });
  it('selects the closest usable boarding stop, a catchable bus, fare and sorted total time', async () => {
    const response = await search().expect(200);
    expect(
      response.body.items.map((item: { route_id: string }) => item.route_id),
    ).toEqual([routeIds.FAST, routeIds.SLOW]);
    expect(response.body.items[0]).toMatchObject({
      route_id: routeIds.FAST,
      boarding_station: { id: stationIds.B },
      walking_distance_m: 56,
      walking_minutes: 1,
      wait_minutes: 4,
      ride_minutes: 12,
      total_minutes: 17,
      distance_km: 4,
      fare_vnd: 6000,
      pickup_at: '2035-01-01T01:05:00.000Z',
      dropoff_at: '2035-01-01T01:17:00.000Z',
    });
    expect(response.body.items[1].total_minutes).toBe(30);
    expect(response.body.max_walking_distance_m).toBe(2000);
  });
  it('returns empty results for origins outside the supported walking range and isolated destinations', async () => {
    expect(
      (await search({ latitude: 10, longitude: 106 }).expect(200)).body.items,
    ).toEqual([]);
    expect(
      (
        await search({
          destination_station_id: stationIds.A,
          latitude: 21.05,
        }).expect(200)
      ).body.items[0]?.route_id,
    ).toBe(routeIds.REVERSE);
  });
  it('rejects inactive destinations, missing coordinates and invalid query values', async () => {
    await search({ destination_station_id: stationIds.D }).expect(404);
    await search({ destination_station_id: stationIds.E }).expect(404);
    for (const query of [
      { latitude: '' },
      { latitude: 91 },
      { longitude: -181 },
      { latitude: ['21', '22'] },
      { latitude: 'NaN' },
      { destination_station_id: '0' },
      { destination_station_id: '18446744073709551616' },
      { unexpected: 1 },
    ])
      await search(query).expect(400);
  });
  it('requires a valid session for route searches', async () => {
    await request(url).get('/journey-planner/journeys').expect(401);
    await user.get('/journey-planner/journeys').expect(401);
  });
});

describe('Journey detail, real MySQL', () => {
  const detail = (extra = {}) =>
    admin.get('/journey-planner/journeys/detail').query({
      latitude: 21.02755,
      longitude: 105.84968,
      destination_station_id: stationIds.C,
      route_id: routeIds.FAST,
      ...extra,
    });
  it('returns the same calculation as search and only stops in the ridden segment', async () => {
    const response = await detail().expect(200);
    expect(response.body).toMatchObject({
      route_id: routeIds.FAST,
      boarding_station: { id: stationIds.B },
      alighting_station: { id: stationIds.C },
      stop_count: 1,
      walking_distance_m: 56,
      walking_minutes: 1,
      wait_minutes: 4,
      ride_minutes: 12,
      total_minutes: 17,
      fare_vnd: 6000,
      walking_after_m: 0,
      walking_after_minutes: 0,
      updated_at: new Date(testNow).toISOString(),
    });
    expect(response.body.stops.map((stop: { id: string }) => stop.id)).toEqual([
      stationIds.B,
      stationIds.C,
    ]);
  });
  it('rejects unusable routes, distant origins, inactive destinations and tampered inputs', async () => {
    for (const route_id of [
      routeIds.OFF,
      routeIds.REVERSE,
      routeIds.CANCEL,
      routeIds.TOMORROW,
    ])
      await detail({ route_id }).expect(404);
    await detail({ latitude: 10 }).expect(404);
    await detail({ destination_station_id: stationIds.D }).expect(404);
    for (const extra of [
      { route_id: '0' },
      { route_id: '18446744073709551616' },
      { route_id: ['1', '2'] },
      { latitude: 91 },
      { fare_vnd: 1 },
    ])
      await detail(extra).expect(400);
    await request(url).get('/journey-planner/journeys/detail').expect(401);
  });
  it('rechecks timetable availability after a search result becomes stale', async () => {
    await db.query("UPDATE schedules SET status='CANCELLED' WHERE route_id=?", [
      routeIds.FAST,
    ]);
    try {
      await detail().expect(404);
    } finally {
      await db.query(
        "UPDATE schedules SET status='DEPARTED' WHERE route_id=?",
        [routeIds.FAST],
      );
    }
  });
});

describe('Origin geocoding API', () => {
  it('requires a session, validates input and returns normalized address coordinates', async () => {
    await request(url)
      .get('/journey-planner/geocoding')
      .query({ search: 'Ho Guom' })
      .expect(401);
    await admin.get('/journey-planner/geocoding').expect(400);
    await admin
      .get('/journey-planner/geocoding')
      .query({ search: ' ' })
      .expect(400);
    await admin
      .get('/journey-planner/geocoding')
      .query({ search: ['a', 'b'] })
      .expect(400);
    await admin
      .get('/journey-planner/geocoding')
      .query({ search: 'a'.repeat(256) })
      .expect(400);
    await admin
      .get('/journey-planner/geocoding')
      .query({ search: 'Ho Guom', url: 'https://example.com' })
      .expect(400);
    const response = await admin
      .get('/journey-planner/geocoding')
      .query({ search: 'Ho Guom' })
      .expect(200);
    expect(response.body.items).toEqual([
      { name: 'Ho Guom, Ha Noi', latitude: 21.028, longitude: 105.852 },
    ]);
    const cached = await admin
      .get('/journey-planner/geocoding')
      .query({ search: '  HO GUOM  ' })
      .expect(200);
    expect(cached.body).toEqual(response.body);
  });

  it('returns a handled provider error while station search remains usable', async () => {
    await admin
      .get('/journey-planner/geocoding')
      .query({ search: 'outage' })
      .expect(503);
    const stations = await admin
      .get('/journey-planner/places')
      .query({ search: prefix })
      .expect(200);
    expect(stations.body.items.length).toBeGreaterThan(0);
  });
});

describe('Journey tracking session API', () => {
  const body = () => ({
    latitude: 21.02755,
    longitude: 105.84968,
    destination_station_id: stationIds.C,
    route_id: routeIds.FAST,
    origin_label: 'Địa chỉ điểm đi đã chọn',
  });
  it('requires auth, CSRF header and valid inputs before creating tracking', async () => {
    await request(url).get('/journey-planner/tracking').expect(401);
    await admin.post('/journey-planner/tracking').send(body()).expect(403);
    await admin
      .post('/journey-planner/tracking')
      .set('X-GoBus-Request', '1')
      .send({ ...body(), latitude: 91 })
      .expect(400);
    await admin
      .post('/journey-planner/tracking')
      .set('X-GoBus-Request', '1')
      .send({ ...body(), fare_vnd: 1 })
      .expect(400);
    await admin
      .post('/journey-planner/tracking')
      .set('X-GoBus-Request', '1')
      .send({ ...body(), origin_label: 'a'.repeat(1001) })
      .expect(400);
    await admin
      .post('/journey-planner/tracking')
      .set('X-GoBus-Request', '1')
      .send({ ...body(), route_id: routeIds.CANCEL })
      .expect(404);
    expect(
      (await admin.get('/journey-planner/tracking').expect(200)).body.active,
    ).toBeNull();
  });
  it('starts from database values, restores, isolates sessions and ends idempotently', async () => {
    const started = await admin
      .post('/journey-planner/tracking')
      .set('X-GoBus-Request', '1')
      .send(body())
      .expect(200);
    const active = started.body.active;
    expect(active).toMatchObject({
      step: 1,
      simulated: true,
      pickup_in_seconds: 300,
      arrival_in_seconds: 1020,
      origin: {
        latitude: 21.02755,
        longitude: 105.84968,
        label: body().origin_label,
      },
      journey: {
        fare_vnd: 6000,
        walking_distance_m: 56,
        wait_minutes: 4,
        alighting_station: {
          id: stationIds.C,
          latitude: 21.05,
          longitude: 105.84968,
        },
      },
    });
    expect(
      (await admin.get('/journey-planner/tracking').expect(200)).body.active.id,
    ).toBe(active.id);
    expect(
      (await admin.get('/journey-planner/tracking').expect(200)).body.active
        .origin.label,
    ).toBe(body().origin_label);
    const repeated = await admin
      .post('/journey-planner/tracking')
      .set('X-GoBus-Request', '1')
      .send(body())
      .expect(200);
    expect(repeated.body.active.id).toBe(active.id);
    await admin
      .post('/journey-planner/tracking')
      .set('X-GoBus-Request', '1')
      .send({ ...body(), route_id: routeIds.SLOW })
      .expect(409);
    const other = request.agent(url);
    await login(
      other,
      process.env.TEST_USER_EMAIL,
      process.env.TEST_USER_PASSWORD,
    ).expect(200);
    expect(
      (await other.get('/journey-planner/tracking').expect(200)).body.active,
    ).toBeNull();
    await other
      .post(`/journey-planner/tracking/${active.id}/end`)
      .set('X-GoBus-Request', '1')
      .expect(200);
    expect(
      (await admin.get('/journey-planner/tracking').expect(200)).body.active.id,
    ).toBe(active.id);
    await admin
      .post(
        '/journey-planner/tracking/00000000-0000-4000-8000-000000000000/end',
      )
      .set('X-GoBus-Request', '1')
      .expect(409);
    await admin.post(`/journey-planner/tracking/${active.id}/end`).expect(403);
    await admin
      .post(`/journey-planner/tracking/${active.id}/end`)
      .set('X-GoBus-Request', '1')
      .expect(200);
    await admin
      .post(`/journey-planner/tracking/${active.id}/end`)
      .set('X-GoBus-Request', '1')
      .expect(200);
    expect(
      (await admin.get('/journey-planner/tracking').expect(200)).body.active,
    ).toBeNull();
    await other.post('/auth/logout').set('X-GoBus-Request', '1').expect(200);
  });
});

describe('Journey map access and segments, real MySQL', () => {
  const map = (extra = {}) =>
    admin.get('/journey-planner/route-map').query({
      route_id: routeIds.FAST,
      from_station_id: stationIds.A,
      to_station_id: stationIds.C,
      ...extra,
    });
  it('requires authentication and validates IDs before accessing the routing service', async () => {
    await request(url).get('/journey-planner/route-map').expect(401);
    await admin.get('/journey-planner/route-map').expect(400);
    await map({ route_id: '18446744073709551616' }).expect(400);
    await map({ route_id: ['1', '2'] }).expect(400);
    await map({ url: 'http://untrusted.example' }).expect(400);
  });
  it('serves the exact stored segment without depending on OSRM', async () => {
    const geometry = {
      version: 1,
      source: 'osrm-driving',
      stops: [
        {
          code: `${prefix}A`,
          latitude: 21.02655,
          longitude: 105.84968,
          stop_order: 1,
        },
        {
          code: `${prefix}B`,
          latitude: 21.02705,
          longitude: 105.84968,
          stop_order: 2,
        },
        {
          code: `${prefix}C`,
          latitude: 21.05,
          longitude: 105.84968,
          stop_order: 3,
        },
      ],
      stop_indices: [0, 2, 4],
      geometry: {
        type: 'LineString',
        coordinates: [
          [105.84968, 21.02655],
          [105.8497, 21.0268],
          [105.84968, 21.02705],
          [105.8497, 21.04],
          [105.84968, 21.05],
        ],
      },
    };
    await db.query('UPDATE routes SET geometry=? WHERE id=?', [
      JSON.stringify(geometry),
      routeIds.FAST,
    ]);
    try {
      const response = await map({ from_station_id: stationIds.B }).expect(200);
      expect(response.body.source).toBe('database');
      expect(response.body.geometry.coordinates).toEqual(
        geometry.geometry.coordinates.slice(2),
      );
      expect(response.body.stops.map((s: { id: string }) => s.id)).toEqual([
        stationIds.B,
        stationIds.C,
      ]);
    } finally {
      await db.query('UPDATE routes SET geometry=NULL WHERE id=?', [
        routeIds.FAST,
      ]);
    }
  });
  it('rejects reversed, equal, nonexistent and inactive segments', async () => {
    await map({
      from_station_id: stationIds.C,
      to_station_id: stationIds.A,
    }).expect(404);
    await map({ to_station_id: stationIds.A }).expect(404);
    await map({ to_station_id: stationIds.E }).expect(404);
    await map({ route_id: routeIds.OFF }).expect(404);
  });
  it('persists OSRM geometry in MySQL, reuses it and falls back after coordinates change during an outage', async () => {
    try {
      const first = await map({ from_station_id: stationIds.B }).expect(200);
      expect(first.body.source).toBe('osrm-driving');
      const [[saved]] = await db.query<RowDataPacket[]>(
        'SELECT geometry FROM routes WHERE id=?',
        [routeIds.FAST],
      );
      const stored =
        typeof saved.geometry === 'string'
          ? JSON.parse(saved.geometry)
          : saved.geometry;
      expect(stored.stops).toHaveLength(3);
      expect(stored.stop_indices).toEqual([0, 2, 4]);
      const second = await map().expect(200);
      expect(second.body.source).toBe('database');
      expect(second.body.geometry.coordinates).toHaveLength(5);
      await db.query('UPDATE stations SET longitude=105.84969 WHERE id=?', [
        stationIds.B,
      ]);
      const offline = await map().expect(200);
      expect(offline.body.source).toBe('straight-line');
      expect(offline.body.approximate).toBe(true);
      expect(offline.body.geometry.coordinates).toEqual([
        [105.84968, 21.02655],
        [105.84969, 21.02705],
        [105.84968, 21.05],
      ]);
      const [[unchanged]] = await db.query<RowDataPacket[]>(
        'SELECT geometry FROM routes WHERE id=?',
        [routeIds.FAST],
      );
      expect(unchanged.geometry).toEqual(saved.geometry);
    } finally {
      await db.query('UPDATE routes SET geometry=NULL WHERE id=?', [
        routeIds.FAST,
      ]);
      await db.query('UPDATE stations SET longitude=105.84968 WHERE id=?', [
        stationIds.B,
      ]);
    }
  });
  it('reports a missing intermediate coordinate without silently bypassing the stop', async () => {
    await db.query(
      'UPDATE stations SET latitude=NULL,longitude=NULL WHERE id=?',
      [stationIds.B],
    );
    try {
      await map().expect(422);
    } finally {
      await db.query(
        'UPDATE stations SET latitude=21.02705,longitude=105.84968 WHERE id=?',
        [stationIds.B],
      );
    }
  });
});

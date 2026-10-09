import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';
import { compare } from 'bcryptjs';
import request from 'supertest';

process.loadEnvFile('../.env');
const prefix = `signup${randomBytes(8).toString('hex')}`;
const emails = ['main', 'race', 'invalid'].map(
  (label) => `${prefix}-${label}@example.test`,
);
const url = 'http://127.0.0.1:3107';
const payload = {
  full_name: '  Nguyễn Đăng Ký  ',
  email: emails[0],
  password: 'DangKy2026! ',
  confirm_password: 'DangKy2026! ',
  terms_accepted: true,
};
let server: ChildProcess;
let db: Connection;
let originalUsers: string;
const digest = (rows: unknown) =>
  createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const register = (body: unknown, actor = request.agent(url)) =>
  actor.post('/auth/register').set('X-GoBus-Request', '1').send(body);

beforeAll(async () => {
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  const [rows] = await db.query('SELECT * FROM users ORDER BY id');
  originalUsers = digest(rows);
  server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: '3107', NODE_ENV: 'test' },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    if (server.exitCode !== null)
      throw new Error('Registration test API exited');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Registration test API did not start');
}, 15000);

afterAll(async () => {
  try {
    if (db) {
      await db.query('DELETE FROM users WHERE email IN (?, ?, ?)', emails);
      const [rows] = await db.query('SELECT * FROM users ORDER BY id');
      expect(digest(rows), 'Original user records are preserved').toBe(
        originalUsers,
      );
    }
  } finally {
    await db?.end();
    if (server?.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
  }
});

describe('Registration with real MySQL and session cookies', () => {
  it('AC-2 AC-6 creates a USER, hashes the password, restores the session and supports later login', async () => {
    const actor = request.agent(url);
    const result = await register(
      { ...payload, email: `  ${emails[0].toUpperCase()}  ` },
      actor,
    ).expect(201);
    expect(result.body).toEqual({
      id: expect.any(String),
      full_name: 'Nguyễn Đăng Ký',
      email: emails[0],
      role: 'USER',
    });
    expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(result.headers['set-cookie'][0]).toContain('SameSite=Strict');
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE email=?',
      [emails[0]],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_active).toBe(1);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await compare(payload.password, rows[0].password_hash)).toBe(true);
    expect(await compare(payload.password.trim(), rows[0].password_hash)).toBe(
      false,
    );
    expect((await actor.get('/auth/me').expect(200)).body).toEqual(result.body);
    await actor.get('/stations').expect(403);
    await actor.post('/auth/logout').set('X-GoBus-Request', '1').expect(200);
    await actor.get('/auth/me').expect(401);
    await actor
      .post('/auth/login')
      .set('X-GoBus-Request', '1')
      .send({ email: emails[0], password: payload.password })
      .expect(200);
    await actor.get('/auth/me').expect(200);
  });

  it('AC-4 rejects an existing email without replacing its password or issuing a session', async () => {
    const actor = request.agent(url);
    const result = await register(
      {
        ...payload,
        email: emails[0].toUpperCase(),
        password: 'AnotherPassword!',
        confirm_password: 'AnotherPassword!',
      },
      actor,
    ).expect(409);
    expect(result.body.message).toContain('Email đã được đăng ký');
    expect(JSON.stringify(result.body)).not.toContain('password_hash');
    await actor.get('/auth/me').expect(401);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT password_hash FROM users WHERE email=?',
      [emails[0]],
    );
    expect(await compare(payload.password, rows[0].password_hash)).toBe(true);
  });

  it('AC-4 permits only one concurrent registration for the same email', async () => {
    const body = { ...payload, email: emails[1] };
    const responses = await Promise.all([register(body), register(body)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email=?',
      [emails[1]],
    );
    expect(rows).toHaveLength(1);
  });

  it.each([
    { full_name: '   ' },
    { full_name: 'a'.repeat(121) },
    { email: 'invalid-email' },
    { password: 'short', confirm_password: 'short' },
    { password: 'ứ'.repeat(25), confirm_password: 'ứ'.repeat(25) },
    { confirm_password: 'mismatch' },
    { confirm_password: undefined },
    { terms_accepted: false },
    { terms_accepted: undefined },
    { terms_accepted: 'true' },
    { role: 'ADMIN' },
    { is_active: false },
    { password_hash: 'injected-hash' },
  ])('AC-3 AC-4 rejects invalid or privileged input %j', async (changes) => {
    await register({ ...payload, email: emails[2], ...changes }).expect(400);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email=?',
      [emails[2]],
    );
    expect(rows).toHaveLength(0);
  });

  it('AC-6 rejects requests without the application header or with another origin', async () => {
    await request(url).post('/auth/register').send(payload).expect(403);
    await request(url)
      .post('/auth/register')
      .set('X-GoBus-Request', '1')
      .set('Origin', 'https://untrusted.example')
      .send(payload)
      .expect(403);
  });

  it('AC-6 rate limits repeated registration attempts', async () => {
    // Earlier requests also count, including successful account creations.
    let status = 0;
    for (let i = 0; i < 21 && status !== 429; i++) {
      status = (await register({})).status;
      expect([400, 429]).toContain(status);
    }
    expect(status).toBe(429);
    expect((await register({})).body.message).toContain('15 phút');
  });
});

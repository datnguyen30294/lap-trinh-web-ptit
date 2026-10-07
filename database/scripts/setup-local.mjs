// Safe bootstrap for a fresh clone or an empty database in an existing volume.
// Uses only Node built-ins; never drops a database or seeds a nonempty schema.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { values } = parseArgs({ options: {
  'env-file': { type: 'string', default: '.env' },
  'project-name': { type: 'string' },
} });
const envPath = resolve(root, values['env-file']);
if (!existsSync(envPath)) {
  const template = readFileSync(resolve(root, '.env.example'), 'utf8');
  writeFileSync(envPath, template.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(32).toString('hex')}`), { flag: 'wx', mode: 0o600 });
  console.log('Đã tạo cấu hình local và session secret riêng cho máy này.');
}
let source = readFileSync(envPath, 'utf8');
let env = parseEnv(source);
if (!env.SESSION_SECRET) {
  const secret = `SESSION_SECRET=${randomBytes(32).toString('hex')}`;
  source = /^SESSION_SECRET=.*$/m.test(source) ? source.replace(/^SESSION_SECRET=.*$/m, secret) : `${source}\n${secret}\n`;
  writeFileSync(envPath, source, { mode: 0o600 });
  env = parseEnv(source);
  console.log('Đã bổ sung SESSION_SECRET; giữ nguyên các cấu hình khác.');
}
const compose = ['compose', '--env-file', envPath, '-f', resolve(root, 'docker-compose.yml')];
if (values['project-name']) compose.push('--project-name', values['project-name']);
const safeMessage = (message) => {
  for (const key of ['DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'SESSION_SECRET'])
    if (env[key]) message = message.split(env[key]).join('[hidden]');
  return message;
};
function docker(args, input) {
  // File values take precedence over a developer's ambient shell variables.
  const result = spawnSync('docker', [...compose, ...args], {
    cwd: root, env: { ...process.env, ...env }, input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw new Error(safeMessage(result.error?.message || result.stderr || result.stdout || 'Docker không chạy được.'));
  return result.stdout.trim();
}
function rootSql(sql, database) {
  return docker(['exec', '-T', 'mysql', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --default-character-set=utf8mb4 -uroot --batch --skip-column-names "$@"',
    'gobus-setup', ...(database ? ['--database', database] : [])], sql);
}
const literal = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
try {
  if (!['127.0.0.1', 'localhost'].includes(env.DB_HOST))
    throw new Error('Lệnh này chỉ dành cho MySQL Docker local. DB_HOST hiện tại được giữ nguyên; xem database/README.md nếu dùng máy chủ khác.');
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(env.DB_NAME || ''))
    throw new Error('DB_NAME phải là tên database hợp lệ (chữ, số, dấu gạch dưới).');
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(env.DB_USER || '') || env.DB_USER === 'root')
    throw new Error('DB_USER phải là tài khoản ứng dụng, không dùng root.');
  if (!env.DB_PASSWORD || !env.MYSQL_ROOT_PASSWORD || (env.SESSION_SECRET?.length || 0) < 32)
    throw new Error('Cần DB_PASSWORD, MYSQL_ROOT_PASSWORD và SESSION_SECRET ít nhất 32 ký tự.');
  console.log('Đang khởi động MySQL và chờ khởi tạo hoàn tất…');
  docker(['up', '-d', '--wait', '--wait-timeout', '180', 'mysql']);
  const name = env.DB_NAME;
  const columns = rootSql(`SELECT CONCAT(TABLE_NAME,'.',COLUMN_NAME) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=${literal(name)} AND TABLE_NAME IN ('users','stations','routes','route_stops','vehicles','schedules','bookings');`);
  const tables = Number(rootSql(`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=${literal(name)};`));
  if (tables > 0) {
    const required = {
      users: ['id', 'email', 'full_name', 'password_hash', 'role', 'is_active'],
      stations: ['id', 'code', 'name', 'address', 'is_active'],
      routes: ['id', 'code', 'name', 'origin_station_id', 'destination_station_id', 'operating_start', 'operating_end', 'distance_km', 'status'],
      route_stops: ['id', 'route_id', 'station_id', 'stop_order', 'km_from_origin', 'minutes_from_origin'],
      vehicles: ['id', 'vehicle_code', 'capacity'],
      schedules: ['id', 'route_id', 'vehicle_id', 'departure_at', 'arrival_at', 'status'],
      bookings: ['id', 'booking_code', 'user_id', 'schedule_id', 'from_station_id', 'to_station_id', 'passenger_name', 'contact_phone', 'unit_price', 'status', 'booked_at', 'cancelled_at'],
    };
    const present = new Set(columns.split(/\r?\n/));
    const missing = Object.entries(required).flatMap(([table, names]) => names.map((column) => `${table}.${column}`)).filter((column) => !present.has(column));
    if (missing.length) throw new Error(`Database ${name} đã tồn tại nhưng thiếu: ${missing.join(', ')}. Không sửa hoặc nạp seed vào database này. Nếu đây là bản ERD cũ, giữ lại nó và đặt DB_NAME=gobus_hanoi_student (hoặc tên mới chưa có dữ liệu), rồi chạy lại. Xem hướng dẫn cho database đã tồn tại.`);
    console.log(`Database ${name} đã tương thích: giữ nguyên schema và dữ liệu, không chạy lại seed.`);
    if (!present.has('routes.geometry'))
      console.log('Bản đồ cần nâng cấp database cũ: chạy migration 006 (nếu thiếu tọa độ), rồi node database/migrations/007-route-geometry.mjs sau khi cài backend.');
  } else {
    rootSql(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
    for (const file of ['01-schema.sql', '02-seed-hanoi.sql', '03-views.sql']) {
      rootSql(readFileSync(resolve(root, 'database', file), 'utf8'), name);
      console.log(`Đã nhập ${file} vào database trống ${name}.`);
    }
  }
  // Old volumes do not receive Docker's MYSQL_DATABASE/MYSQL_USER initialization again.
  rootSql(`CREATE USER IF NOT EXISTS ${literal(env.DB_USER)}@'%' IDENTIFIED BY ${literal(env.DB_PASSWORD)};
    GRANT ALL PRIVILEGES ON \`${name}\`.* TO ${literal(env.DB_USER)}@'%';`);
  docker(['exec', '-T', 'mysql', 'sh', '-c',
    'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=tcp -h127.0.0.1 --default-character-set=utf8mb4 -u"$MYSQL_USER" --database "$MYSQL_DATABASE" --batch --skip-column-names -e "SELECT 1"']);
  console.log(`Sẵn sàng: ${env.DB_HOST}:${env.DB_PORT} / ${name}. Dữ liệu cũ và Docker volume được giữ nguyên.`);
  console.log('Tiếp theo: npm ci trong backend/ và frontend/, rồi chạy hai ứng dụng theo README.md.');
} catch (error) {
  console.error(safeMessage(error.message));
  console.error('Nếu lỗi xác thực trên volume cũ, kiểm tra mật khẩu đã dùng khi tạo volume. Không xóa volume để thử sửa lỗi.');
  process.exitCode = 1;
}

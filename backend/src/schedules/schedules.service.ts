import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { RoutesService } from '../routes/routes.service.js';
import type {
  ListSchedulesDto,
  PageDto,
  ScheduleDto,
  ScheduleStatusDto,
} from './dto/schedule.dto.js';
import { dayStart, sqlTime, utcTime, vietnamTime } from './schedule-time.js';
type ScheduleRow = ScheduleDto & {
  id: string;
  status: string;
  route_code: string;
  route_name: string;
  origin_name: string;
  destination_name: string;
  vehicle_code: string;
  capacity: number;
  confirmed_bookings: number;
  booking_count: number;
  server_now: string;
};
const dateColumn = (column: string, alias: string) =>
  `DATE_FORMAT(${column},'%Y-%m-%dT%H:%i:%s.%fZ') AS ${alias}`;
const baseColumns = `s.id,s.route_id,s.vehicle_id,s.status,${dateColumn('s.departure_at', 'departure_at')},${dateColumn('s.arrival_at', 'arrival_at')}`;
const joins =
  'FROM schedules s JOIN routes r ON r.id=s.route_id JOIN stations o ON o.id=r.origin_station_id JOIN stations d ON d.id=r.destination_station_id JOIN vehicles v ON v.id=s.vehicle_id';
const columns = `${baseColumns},r.code AS route_code,r.name AS route_name,o.name AS origin_name,d.name AS destination_name,v.vehicle_code,v.capacity,
 (SELECT COUNT(*) FROM bookings b WHERE b.schedule_id=s.id AND b.status='CONFIRMED') AS confirmed_bookings,
 (SELECT COUNT(*) FROM bookings b WHERE b.schedule_id=s.id) AS booking_count,${dateColumn('UTC_TIMESTAMP(3)', 'server_now')}`;
const sorted = (ids: string[]) =>
  [...new Set(ids)].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
const validId = (id: string) => {
  if (BigInt(id) > 18446744073709551615n)
    throw new BadRequestException('ID vượt giới hạn BIGINT.');
};
const iso = (value: string) => value.replace(/(\.\d{3})\d*Z$/, '$1Z');
@Injectable()
export class SchedulesService {
  constructor(
    private readonly db: DataSource,
    private readonly routes: RoutesService,
  ) {}
  private normalize(row: ScheduleRow) {
    const r = {
      ...row,
      id: String(row.id),
      route_id: String(row.route_id),
      vehicle_id: String(row.vehicle_id),
      departure_at: iso(row.departure_at),
      arrival_at: iso(row.arrival_at),
      server_now: iso(row.server_now),
      capacity: Number(row.capacity),
      confirmed_bookings: Number(row.confirmed_bookings),
      has_bookings: Number(row.booking_count) > 0,
    };
    const reason = r.has_bookings
      ? 'Lịch trình đã có đơn đặt vé, kể cả đơn đã hủy. Không được thay đổi thông tin lịch sử.'
      : r.status !== 'SCHEDULED'
        ? 'Chỉ được sửa lịch trình đang lên lịch.'
        : r.departure_at <= r.server_now
          ? 'Lịch trình đã tới giờ khởi hành, không thể chỉnh sửa.'
          : '';
    return { ...r, can_edit: !reason, edit_block_reason: reason };
  }
  async list(q: ListSchedulesDto) {
    const where: string[] = [];
    const args: unknown[] = [];
    if (q.route_id) {
      validId(q.route_id);
      where.push('s.route_id=?');
      args.push(q.route_id);
    }
    if (q.status) {
      where.push('s.status=?');
      args.push(q.status);
    }
    if (q.search) {
      const term = `%${q.search.replace(/[!%_]/g, (c) => `!${c}`)}%`;
      where.push(
        "(r.code LIKE ? ESCAPE '!' OR r.name LIKE ? ESCAPE '!' OR v.vehicle_code LIKE ? ESCAPE '!')",
      );
      args.push(term, term, term);
    }
    const from = q.date_from === undefined ? undefined : dayStart(q.date_from),
      to = q.date_to === undefined ? undefined : dayStart(q.date_to);
    if (from !== undefined && to !== undefined && from > to)
      throw new BadRequestException(
        'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
      );
    if (from !== undefined) {
      where.push('s.departure_at>=?');
      args.push(sqlTime(from));
    }
    if (to !== undefined) {
      where.push('s.departure_at<?');
      args.push(sqlTime(to + 86400000));
    }
    const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    return this.db.transaction(async (m) => {
      const [{ total }] = await m.query<{ total: number }[]>(
        `SELECT COUNT(*) AS total ${joins}${filter}`,
        args,
      );
      const rows = await m.query<ScheduleRow[]>(
        `SELECT ${columns} ${joins}${filter} ORDER BY s.departure_at DESC,s.id DESC LIMIT ? OFFSET ?`,
        [...args, q.limit, (q.page - 1) * q.limit],
      );
      return {
        items: rows.map((r) => this.normalize(r)),
        total: Number(total),
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
      };
    });
  }
  async vehicles(q: PageDto) {
    const args = q.search
      ? [`%${q.search.replace(/[!%_]/g, (c) => `!${c}`)}%`]
      : [];
    const where = q.search ? " WHERE vehicle_code LIKE ? ESCAPE '!'" : '';
    return this.db.transaction(async (m) => {
      const [{ total }] = await m.query<{ total: number }[]>(
        `SELECT COUNT(*) AS total FROM vehicles${where}`,
        args,
      );
      const rows = await m.query<
        { id: string; vehicle_code: string; capacity: number }[]
      >(
        `SELECT id,vehicle_code,capacity FROM vehicles${where} ORDER BY vehicle_code,id LIMIT ? OFFSET ?`,
        [...args, q.limit, (q.page - 1) * q.limit],
      );
      return {
        items: rows.map((v) => ({ ...v, id: String(v.id) })),
        total: Number(total),
        page: q.page,
        limit: q.limit,
        totalPages: Math.ceil(total / q.limit),
      };
    });
  }
  async detail(
    id: string,
    m?: EntityManager,
  ): Promise<
    ReturnType<SchedulesService['normalize']> & {
      stops: Array<Record<string, unknown>>;
    }
  > {
    if (!m) return this.db.transaction((manager) => this.detail(id, manager));
    const [row] = await m.query<ScheduleRow[]>(
      `SELECT ${columns} ${joins} WHERE s.id=?`,
      [id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy lịch trình.');
    const r = this.normalize(row);
    const route = await this.routes.detail(r.route_id, m);
    return {
      ...r,
      stops: route.stops.map((s) => ({
        ...s,
        expected_at:
          s.minutes_from_origin === null
            ? null
            : new Date(
                Date.parse(r.departure_at) + s.minutes_from_origin * 60000,
              ).toISOString(),
      })),
    };
  }
  private async row(m: EntityManager, id: string, lock = false) {
    const [r] = await m.query<ScheduleRow[]>(
      `SELECT ${baseColumns} FROM schedules s WHERE s.id=?${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    if (!r) throw new NotFoundException('Không tìm thấy lịch trình.');
    return {
      ...r,
      id: String(r.id),
      route_id: String(r.route_id),
      vehicle_id: String(r.vehicle_id),
      departure_at: iso(r.departure_at),
      arrival_at: iso(r.arrival_at),
    };
  }
  private async snapshots(routeIds: string[]) {
    return Promise.all(sorted(routeIds).map((id) => this.routes.detail(id)));
  }
  private async lockParents(
    m: EntityManager,
    snapshots: Awaited<ReturnType<SchedulesService['snapshots']>>,
    vehicleIds: string[],
  ) {
    const ids = sorted(
      snapshots.flatMap((r) => [
        r.origin_station_id,
        r.destination_station_id,
        ...r.stops.map((s) => s.station_id),
      ]),
    );
    const active = new Map<string, boolean>();
    for (const id of ids) {
      const [s] = await m.query<{ is_active: number }[]>(
        'SELECT is_active FROM stations WHERE id=? FOR UPDATE',
        [id],
      );
      if (!s)
        throw new ConflictException('Bến vừa thay đổi. Vui lòng tải lại.');
      active.set(id, !!s.is_active);
    }
    const routes = new Map<
      string,
      Awaited<ReturnType<RoutesService['detail']>>
    >();
    for (const snapshot of snapshots) {
      const rows = await m.query(
        'SELECT id FROM routes WHERE id=? FOR UPDATE',
        [snapshot.id],
      );
      if (!rows.length) throw new NotFoundException('Không tìm thấy tuyến xe.');
      await m.query(
        'SELECT id FROM route_stops WHERE route_id=? ORDER BY stop_order FOR UPDATE',
        [snapshot.id],
      );
      const route = await this.routes.detail(snapshot.id, m);
      if (
        [
          route.origin_station_id,
          route.destination_station_id,
          ...route.stops.map((s) => s.station_id),
        ].some((id) => !active.has(id))
      )
        throw new ConflictException(
          'Hành trình vừa thay đổi. Vui lòng tải lại và thử lại.',
        );
      routes.set(route.id, route);
    }
    for (const id of sorted(vehicleIds)) {
      const rows = await m.query(
        'SELECT id FROM vehicles WHERE id=? FOR UPDATE',
        [id],
      );
      if (!rows.length)
        throw new BadRequestException(`Xe ${id} không tồn tại.`);
    }
    return { routes, active };
  }
  private validateTimes(dto: ScheduleDto) {
    validId(dto.route_id);
    validId(dto.vehicle_id);
    const start = utcTime(dto.departure_at),
      end = utcTime(dto.arrival_at);
    if (start >= end)
      throw new BadRequestException('Giờ khởi hành phải trước giờ đến.');
    return { start, end };
  }
  private async validateJourney(
    m: EntityManager,
    dto: ScheduleDto,
    parents: Awaited<ReturnType<SchedulesService['lockParents']>>,
    future: boolean,
  ) {
    const { start, end } = this.validateTimes(dto);
    const route = parents.routes.get(dto.route_id)!;
    if (route.status !== 'ACTIVE')
      throw new ConflictException(
        'Tuyến đang ngừng hoạt động. Không thể phân lịch hoặc khởi hành.',
      );
    if (route.stops.some((s) => !parents.active.get(s.station_id)))
      throw new ConflictException('Hành trình có bến đang ngừng hoạt động.');
    this.routes.validateJourney(route);
    if (end - start !== route.stops.at(-1)!.minutes_from_origin! * 60000)
      throw new BadRequestException(
        'Giờ đến phải khớp thời lượng tại điểm cuối của tuyến.',
      );
    const localStart = vietnamTime(start),
      localEnd = vietnamTime(end);
    if (
      localStart.slice(0, 10) !== localEnd.slice(0, 10) ||
      localStart.slice(11, 23) < `${route.operating_start}.000` ||
      localEnd.slice(11, 23) > `${route.operating_end}.000`
    )
      throw new BadRequestException(
        'Lịch trình phải cùng ngày Việt Nam và nằm trong giờ hoạt động của tuyến.',
      );
    const [{ now }] = await m.query<{ now: string }[]>(
      `SELECT ${dateColumn('UTC_TIMESTAMP(3)', 'now')}`,
    );
    if (future && start <= Date.parse(now))
      throw new ConflictException(
        'Giờ khởi hành phải ở tương lai theo đồng hồ máy chủ.',
      );
  }
  private async overlap(m: EntityManager, dto: ScheduleDto, id = '0') {
    const rows = await m.query<{ id: string }[]>(
      "SELECT id FROM schedules WHERE vehicle_id=? AND id<>? AND status<>'CANCELLED' AND departure_at<? AND arrival_at>? ORDER BY id LIMIT 1 FOR UPDATE",
      [
        dto.vehicle_id,
        id,
        sqlTime(utcTime(dto.arrival_at)),
        sqlTime(utcTime(dto.departure_at)),
      ],
    );
    if (rows.length)
      throw new ConflictException(
        `Xe bị trùng khoảng chạy với lịch trình #${rows[0].id}. Vui lòng chọn xe hoặc thời gian khác.`,
      );
  }
  private async transaction<T>(work: (m: EntityManager) => Promise<T>) {
    try {
      return await this.db.transaction('READ COMMITTED', work);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string }).code;
        if (code === 'ER_DUP_ENTRY')
          throw new ConflictException(
            'Xe đã có lịch trình cùng giờ khởi hành, kể cả lịch đã hủy. Vui lòng chọn thời gian hoặc xe khác.',
          );
        if (
          ['ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2'].includes(
            code ?? '',
          )
        )
          throw new ConflictException(
            'Dữ liệu liên kết đã thay đổi. Vui lòng tải lại.',
          );
        if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code ?? ''))
          throw new ConflictException(
            'Dữ liệu đang được cập nhật đồng thời. Vui lòng tải lại và thử lại.',
          );
      }
      throw error;
    }
  }
  async create(dto: ScheduleDto) {
    this.validateTimes(dto);
    const snapshots = await this.snapshots([dto.route_id]);
    return this.transaction(async (m) => {
      const parents = await this.lockParents(m, snapshots, [dto.vehicle_id]);
      await this.validateJourney(m, dto, parents, true);
      await this.overlap(m, dto);
      await m.query(
        "INSERT INTO schedules(route_id,vehicle_id,departure_at,arrival_at,status) VALUES (?,?,?,?,'SCHEDULED')",
        [
          dto.route_id,
          dto.vehicle_id,
          sqlTime(utcTime(dto.departure_at)),
          sqlTime(utcTime(dto.arrival_at)),
        ],
      );
      const [{ id }] = await m.query<{ id: string }[]>(
        'SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id',
      );
      return this.detail(id, m);
    });
  }
  async update(id: string, dto: ScheduleDto) {
    this.validateTimes(dto);
    const before = await this.row(this.db.manager, id);
    const snapshots = await this.snapshots([before.route_id, dto.route_id]);
    return this.transaction(async (m) => {
      const parents = await this.lockParents(m, snapshots, [
        before.vehicle_id,
        dto.vehicle_id,
      ]);
      const current = await this.row(m, id, true);
      this.sameParents(current, before);
      const bookings = await m.query(
        'SELECT id FROM bookings WHERE schedule_id=? ORDER BY id FOR UPDATE',
        [id],
      );
      if (bookings.length)
        throw new ConflictException(
          'Lịch trình đã có đơn đặt vé, kể cả đơn đã hủy. Không được thay đổi thông tin lịch sử.',
        );
      const [{ now }] = await m.query<{ now: string }[]>(
        `SELECT ${dateColumn('UTC_TIMESTAMP(3)', 'now')}`,
      );
      if (
        current.status !== 'SCHEDULED' ||
        Date.parse(current.departure_at) <= Date.parse(now)
      )
        throw new ConflictException(
          'Chỉ được sửa lịch trình SCHEDULED chưa tới giờ khởi hành.',
        );
      await this.validateJourney(m, dto, parents, true);
      await this.overlap(m, dto, id);
      await m.query(
        'UPDATE schedules SET route_id=?,vehicle_id=?,departure_at=?,arrival_at=? WHERE id=?',
        [
          dto.route_id,
          dto.vehicle_id,
          sqlTime(utcTime(dto.departure_at)),
          sqlTime(utcTime(dto.arrival_at)),
          id,
        ],
      );
      return this.detail(id, m);
    });
  }
  private sameParents(current: ScheduleDto, before: ScheduleDto) {
    if (
      current.route_id !== before.route_id ||
      current.vehicle_id !== before.vehicle_id
    )
      throw new ConflictException(
        'Lịch trình vừa đổi tuyến hoặc xe. Vui lòng tải lại.',
      );
  }
  async setStatus(id: string, status: ScheduleStatusDto['status']) {
    const before = await this.row(this.db.manager, id);
    const snapshots = await this.snapshots([before.route_id]);
    return this.transaction(async (m) => {
      const parents = await this.lockParents(m, snapshots, [before.vehicle_id]);
      const current = await this.row(m, id, true);
      this.sameParents(current, before);
      const bookings = await m.query<{ status: string }[]>(
        'SELECT id,status FROM bookings WHERE schedule_id=? ORDER BY id FOR UPDATE',
        [id],
      );
      const [{ now }] = await m.query<{ now: string }[]>(
        `SELECT ${dateColumn('UTC_TIMESTAMP(3)', 'now')}`,
      );
      const time = Date.parse(now);
      if (current.status === 'SCHEDULED' && status === 'CANCELLED') {
        if (bookings.some((b) => b.status === 'CONFIRMED'))
          throw new ConflictException(
            'Không thể hủy lịch trình còn vé CONFIRMED. Hệ thống không tự hủy vé hoặc hoàn tiền.',
          );
      } else if (current.status === 'SCHEDULED' && status === 'DEPARTED') {
        if (
          time < Date.parse(current.departure_at) ||
          time >= Date.parse(current.arrival_at)
        )
          throw new ConflictException(
            'Chỉ được khởi hành từ giờ xuất phát đến trước giờ đến dự kiến.',
          );
        await this.validateJourney(m, current, parents, false);
        await this.overlap(m, current, id);
      } else if (current.status === 'DEPARTED' && status === 'COMPLETED') {
        if (time < Date.parse(current.arrival_at))
          throw new ConflictException(
            'Chưa tới giờ đến dự kiến, không thể hoàn thành chuyến.',
          );
      } else
        throw new ConflictException(
          'Chuyển trạng thái không hợp lệ hoặc đã được thực hiện. Lịch hủy/hoàn thành không được khôi phục.',
        );
      await m.query('UPDATE schedules SET status=? WHERE id=?', [status, id]);
      return this.detail(id, m);
    });
  }
}

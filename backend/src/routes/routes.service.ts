import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import type { CreateRouteDto, RouteDto, StopDto } from './dto/route.dto.js';
import type { ListRoutesDto } from './dto/list-routes.dto.js';
type RouteRow = Omit<CreateRouteDto, 'stops'> & {
  id: string;
  origin_name: string;
  destination_name: string;
  stop_count: number;
};
type StopRow = StopDto & {
  id: string;
  station_name: string;
  station_code: string;
  is_active: number;
};
const columns = `r.*, o.name AS origin_name, d.name AS destination_name,
  (SELECT COUNT(*) FROM route_stops rs WHERE rs.route_id=r.id) AS stop_count`;
const joins =
  'FROM routes r JOIN stations o ON o.id=r.origin_station_id JOIN stations d ON d.id=r.destination_station_id';
const sameStops = (a: StopDto[], b: StopDto[]) =>
  a.length === b.length &&
  a.every(
    (s, i) =>
      String(s.station_id) === String(b[i].station_id) &&
      s.stop_order === b[i].stop_order &&
      s.minutes_from_origin === b[i].minutes_from_origin &&
      Number(s.km_from_origin) === Number(b[i].km_from_origin),
  );
@Injectable()
export class RoutesService {
  constructor(private readonly db: DataSource) {}
  async list({ page, limit, search, status }: ListRoutesDto) {
    const where: string[] = [];
    const args: unknown[] = [];
    if (search) {
      const term = `%${search.replace(/[!%_]/g, (c) => `!${c}`)}%`;
      where.push("(r.code LIKE ? ESCAPE '!' OR r.name LIKE ? ESCAPE '!')");
      args.push(term, term);
    }
    if (status) {
      where.push('r.status=?');
      args.push(status);
    }
    const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    return this.db.transaction(async (m) => {
      const [{ total }] = await m.query<{ total: number }[]>(
        `SELECT COUNT(*) AS total FROM routes r${clause}`,
        args,
      );
      const rows = await m.query<RouteRow[]>(
        `SELECT ${columns} ${joins}${clause} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
        [...args, limit, (page - 1) * limit],
      );
      return {
        items: rows.map((r) => this.normalize(r)),
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });
  }
  private normalize(r: RouteRow) {
    return {
      ...r,
      id: String(r.id),
      origin_station_id: String(r.origin_station_id),
      destination_station_id: String(r.destination_station_id),
      distance_km: Number(r.distance_km),
      stop_count: Number(r.stop_count),
    };
  }
  private async stops(m: EntityManager, id: string, lock = false) {
    const rows = await m.query<StopRow[]>(
      `SELECT rs.*, s.name AS station_name, s.code AS station_code, s.is_active FROM route_stops rs JOIN stations s ON s.id=rs.station_id WHERE rs.route_id=? ORDER BY rs.stop_order${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    return rows.map((s) => ({
      ...s,
      id: String(s.id),
      station_id: String(s.station_id),
      km_from_origin: Number(s.km_from_origin),
    }));
  }
  async detail(
    id: string,
    manager?: EntityManager,
  ): Promise<
    ReturnType<RoutesService['normalize']> & {
      stops: StopRow[];
      has_bookings: boolean;
      schedule_count: number;
    }
  > {
    if (!manager) return this.db.transaction((m) => this.detail(id, m));
    const [row] = await manager.query<RouteRow[]>(
      `SELECT ${columns} ${joins} WHERE r.id=?`,
      [id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy tuyến xe.');
    const [{ count }] = await manager.query<{ count: number }[]>(
      'SELECT COUNT(*) AS count FROM schedules WHERE route_id=?',
      [id],
    );
    const bookings = await manager.query(
      'SELECT b.id FROM bookings b JOIN schedules s ON s.id=b.schedule_id WHERE s.route_id=? LIMIT 1',
      [id],
    );
    return {
      ...this.normalize(row),
      stops: await this.stops(manager, id),
      has_bookings: bookings.length > 0,
      schedule_count: Number(count),
    };
  }
  validateJourney(dto: RouteDto, allowMissingMinutes = false) {
    if (dto.stops.length < 2)
      throw new BadRequestException(
        'Hành trình cần ít nhất hai bến khác nhau.',
      );
    if (dto.operating_start >= dto.operating_end)
      throw new BadRequestException(
        'Giờ bắt đầu phải nhỏ hơn giờ kết thúc; chưa hỗ trợ hoạt động qua đêm.',
      );
    if (new Set(dto.stops.map((s) => s.station_id)).size !== dto.stops.length)
      throw new BadRequestException('Không được lặp bến trong hành trình.');
    if (
      dto.origin_station_id !== dto.stops[0].station_id ||
      dto.destination_station_id !== dto.stops.at(-1)!.station_id
    )
      throw new BadRequestException(
        'Bến đầu và bến cuối phải khớp hai đầu hành trình.',
      );
    for (const [i, s] of dto.stops.entries()) {
      if (BigInt(s.station_id) > 18446744073709551615n)
        throw new BadRequestException('ID bến vượt giới hạn.');
      if (s.stop_order !== i + 1)
        throw new BadRequestException('Thứ tự điểm dừng phải liên tục từ 1.');
      if (s.minutes_from_origin === null && !allowMissingMinutes)
        throw new BadRequestException(
          `Điểm ${i + 1} chưa có số phút. Vui lòng hoàn thiện hành trình.`,
        );
      if (
        i === 0 &&
        (s.km_from_origin !== 0 ||
          (s.minutes_from_origin !== null && s.minutes_from_origin !== 0))
      )
        throw new BadRequestException(
          'Điểm đầu phải có số phút và số km bằng 0.',
        );
      if (
        i > 0 &&
        (s.km_from_origin <= dto.stops[i - 1].km_from_origin ||
          (s.minutes_from_origin !== null &&
            dto.stops[i - 1].minutes_from_origin !== null &&
            s.minutes_from_origin <= dto.stops[i - 1].minutes_from_origin!))
      )
        throw new BadRequestException(
          `Điểm ${i + 1}: số phút và số km phải tăng nghiêm ngặt.`,
        );
    }
    if (dto.stops.at(-1)!.km_from_origin !== dto.distance_km)
      throw new BadRequestException(
        'Số km điểm cuối phải bằng tổng khoảng cách tuyến.',
      );
  }
  private async lockStations(
    m: EntityManager,
    ids: string[],
    active: boolean,
    activeIds = ids,
  ) {
    const unique = [...new Set(ids)].sort((a, b) =>
      BigInt(a) < BigInt(b) ? -1 : 1,
    );
    for (const id of unique) {
      const [s] = await m.query<{ is_active: number }[]>(
        'SELECT is_active FROM stations WHERE id=? FOR UPDATE',
        [id],
      );
      if (!s) throw new BadRequestException(`Bến ${id} không tồn tại.`);
      if (active && activeIds.includes(id) && !s.is_active)
        throw new ConflictException(
          `Bến ${id} đang ngừng hoạt động. Tuyến ACTIVE chỉ được sử dụng bến đang hoạt động.`,
        );
    }
    return unique;
  }
  private async transaction<T>(work: (m: EntityManager) => Promise<T>) {
    try {
      return await this.db.transaction(work);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string }).code;
        if (code === 'ER_DUP_ENTRY')
          throw new ConflictException(
            'Mã tuyến đã tồn tại. Vui lòng chọn mã khác.',
          );
        if (
          ['ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2'].includes(
            code ?? '',
          )
        )
          throw new ConflictException(
            'Hành trình có dữ liệu liên kết. Không thể thay đổi điểm dừng.',
          );
        if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code ?? ''))
          throw new ConflictException(
            'Dữ liệu đang được thay đổi đồng thời. Vui lòng tải lại và thử lại.',
          );
      }
      throw error;
    }
  }
  private async insertStops(m: EntityManager, id: string, stops: StopDto[]) {
    for (const s of stops)
      await m.query(
        'INSERT INTO route_stops (route_id,station_id,stop_order,minutes_from_origin,km_from_origin) VALUES (?,?,?,?,?)',
        [
          id,
          s.station_id,
          s.stop_order,
          s.minutes_from_origin,
          s.km_from_origin,
        ],
      );
  }
  async create(dto: CreateRouteDto) {
    this.validateJourney(dto);
    return this.transaction(async (m) => {
      await this.lockStations(
        m,
        dto.stops.map((s) => s.station_id),
        dto.status === 'ACTIVE',
      );
      await m.query(
        'INSERT INTO routes (code,name,origin_station_id,destination_station_id,operating_start,operating_end,distance_km,status) VALUES (?,?,?,?,?,?,?,?)',
        [
          dto.code,
          dto.name,
          dto.origin_station_id,
          dto.destination_station_id,
          dto.operating_start,
          dto.operating_end,
          dto.distance_km,
          dto.status,
        ],
      );
      const [{ id }] = await m.query<{ id: string }[]>(
        'SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id',
      );
      await this.insertStops(m, id, dto.stops);
      return this.detail(id, m);
    });
  }
  private async lockRoute(
    m: EntityManager,
    id: string,
    snapshot: {
      origin_station_id: string;
      destination_station_id: string;
      stops: StopDto[];
    },
    newStops: StopDto[] = [],
  ) {
    // Recheck the pre-transaction snapshot after acquiring station locks.
    const ids = await this.lockStations(
      m,
      [
        snapshot.origin_station_id,
        snapshot.destination_station_id,
        ...snapshot.stops.map((s) => s.station_id),
        ...newStops.map((s) => s.station_id),
      ],
      false,
    );
    const [row] = await m.query<RouteRow[]>(
      'SELECT * FROM routes WHERE id=? FOR UPDATE',
      [id],
    );
    if (!row) throw new NotFoundException('Không tìm thấy tuyến xe.');
    const stops = await this.stops(m, id, true);
    if (
      [
        String(row.origin_station_id),
        String(row.destination_station_id),
        ...stops.map((s) => s.station_id),
      ].some((s) => !ids.includes(s))
    )
      throw new ConflictException(
        'Hành trình vừa thay đổi. Vui lòng tải lại trước khi lưu.',
      );
    const schedules = await m.query<{ id: string }[]>(
      'SELECT id FROM schedules WHERE route_id=? ORDER BY id FOR UPDATE',
      [id],
    );
    const bookings = await m.query<{ id: string }[]>(
      'SELECT b.id FROM bookings b JOIN schedules s ON s.id=b.schedule_id WHERE s.route_id=? ORDER BY b.id FOR UPDATE',
      [id],
    );
    return { route: { ...this.normalize(row), stops }, schedules, bookings };
  }
  private async checkSchedules(
    m: EntityManager,
    id: string,
    dto: RouteDto,
    hours: boolean,
    duration: boolean,
  ) {
    if (hours) {
      const rows = await m.query(
        `SELECT id FROM schedules WHERE route_id=? AND
        (TIME(DATE_ADD(departure_at, INTERVAL 7 HOUR)) < CAST(? AS TIME(3)) OR TIME(DATE_ADD(arrival_at, INTERVAL 7 HOUR)) > CAST(? AS TIME(3))
        OR DATE(DATE_ADD(departure_at, INTERVAL 7 HOUR)) <> DATE(DATE_ADD(arrival_at, INTERVAL 7 HOUR))) LIMIT 1`,
        [id, dto.operating_start, dto.operating_end],
      );
      if (rows.length)
        throw new ConflictException(
          `Lịch trình ${rows[0].id} nằm ngoài giờ hoạt động mới. Hãy xử lý lịch trình trước.`,
        );
    }
    if (duration) {
      const rows = await m.query(
        'SELECT id FROM schedules WHERE route_id=? AND TIMESTAMPDIFF(MICROSECOND,departure_at,arrival_at) <> ? LIMIT 1',
        [id, dto.stops.at(-1)!.minutes_from_origin! * 60000000],
      );
      if (rows.length)
        throw new ConflictException(
          `Thời lượng mới không khớp lịch trình ${rows[0].id}. Không thể tự thay đổi lịch trình.`,
        );
    }
  }
  private async checkStopReferences(m: EntityManager, id: string) {
    const refs = await m.query<
      {
        TABLE_NAME: string;
        CONSTRAINT_NAME: string;
        COLUMN_NAME: string;
        REFERENCED_COLUMN_NAME: string;
      }[]
    >(
      `SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME='route_stops' AND TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION`,
    );
    const groups = new Map<string, typeof refs>();
    for (const ref of refs) {
      const key = `${ref.TABLE_NAME}.${ref.CONSTRAINT_NAME}`;
      groups.set(key, [...(groups.get(key) ?? []), ref]);
    }
    const quote = (name: string) => '`' + name.replace(/`/g, '``') + '`';
    for (const group of groups.values()) {
      const on = group
        .map(
          (r) =>
            `linked.${quote(r.COLUMN_NAME)}=rs.${quote(r.REFERENCED_COLUMN_NAME)}`,
        )
        .join(' AND ');
      const rows = await m.query(
        `SELECT rs.id FROM ${quote(group[0].TABLE_NAME)} linked JOIN route_stops rs ON ${on} WHERE rs.route_id=? LIMIT 1 FOR UPDATE`,
        [id],
      );
      if (rows.length)
        throw new ConflictException(
          'Điểm dừng đang được dữ liệu khác tham chiếu. Hãy xử lý liên kết trước khi thay hành trình.',
        );
    }
  }
  async update(id: string, dto: RouteDto) {
    const snapshot = await this.detail(id);
    return this.transaction(async (m) => {
      const { route, bookings } = await this.lockRoute(
        m,
        id,
        snapshot,
        dto.stops,
      );
      const changed =
        !sameStops(route.stops, dto.stops) ||
        route.origin_station_id !== dto.origin_station_id ||
        route.destination_station_id !== dto.destination_station_id ||
        route.distance_km !== dto.distance_km;
      if (
        bookings.length &&
        (changed || route.code !== dto.code || route.name !== dto.name)
      )
        throw new ConflictException(
          'Tuyến đã có đơn đặt vé, kể cả đơn đã hủy. Không được đổi mã, tên hoặc hành trình làm thay đổi lịch sử.',
        );
      this.validateJourney(dto, !changed);
      await this.lockStations(
        m,
        dto.stops.map((s) => s.station_id),
        route.status === 'ACTIVE',
      );
      await this.checkSchedules(
        m,
        id,
        dto,
        route.operating_start !== dto.operating_start ||
          route.operating_end !== dto.operating_end,
        route.stops.at(-1)?.minutes_from_origin !==
          dto.stops.at(-1)!.minutes_from_origin,
      );
      if (changed) {
        const tables = await m.query(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='fares'",
        );
        if (
          tables.length &&
          (
            await m.query(
              'SELECT id FROM fares WHERE route_id=? LIMIT 1 FOR UPDATE',
              [id],
            )
          ).length
        )
          throw new ConflictException(
            'Tuyến có giá vé liên kết. Hãy xử lý giá vé trước khi thay hành trình.',
          );
        await this.checkStopReferences(m, id);
        // Restrictive foreign keys remain the final guard against concurrent inserts.
        await m.query('DELETE FROM route_stops WHERE route_id=?', [id]);
        await this.insertStops(m, id, dto.stops);
      }
      await m.query(
        'UPDATE routes SET code=?,name=?,origin_station_id=?,destination_station_id=?,operating_start=?,operating_end=?,distance_km=? WHERE id=?',
        [
          dto.code,
          dto.name,
          dto.origin_station_id,
          dto.destination_station_id,
          dto.operating_start,
          dto.operating_end,
          dto.distance_km,
          id,
        ],
      );
      return this.detail(id, m);
    });
  }
  async setStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const snapshot = await this.detail(id);
    return this.transaction(async (m) => {
      const { route } = await this.lockRoute(m, id, snapshot);
      if (status === 'ACTIVE') {
        this.validateJourney(route);
        await this.lockStations(
          m,
          route.stops.map((s) => s.station_id),
          true,
        );
        await this.checkSchedules(m, id, route, true, true);
      } else {
        const confirmed = await m.query(
          "SELECT b.id FROM bookings b JOIN schedules s ON s.id=b.schedule_id WHERE s.route_id=? AND s.departure_at >= UTC_TIMESTAMP(3) AND b.status='CONFIRMED' LIMIT 1",
          [id],
        );
        if (confirmed.length)
          throw new ConflictException(
            'Không thể ngừng tuyến: chuyến tương lai còn vé CONFIRMED. Hãy xử lý vé và lịch trình trước; hệ thống không tự hủy vé.',
          );
      }
      await m.query('UPDATE routes SET status=? WHERE id=?', [status, id]);
      return this.detail(id, m);
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { dayStart, sqlTime } from '../schedules/schedule-time.js';
import type {
  BookingListDto,
  CreateBookingDto,
  TripSearchDto,
  TripSegmentDto,
} from './booking.dto.js';
import type { Ticket, Trip } from './booking.types.js';

// These joins are shared by search and quote, so the price and trip agree.
const tripJoins = `FROM schedules sc
  JOIN routes r ON r.id=sc.route_id
  JOIN vehicles v ON v.id=sc.vehicle_id
  JOIN route_stops a ON a.route_id=r.id AND a.station_id=?
  JOIN route_stops z ON z.route_id=r.id AND z.station_id=? AND z.stop_order>a.stop_order
  JOIN stations sa ON sa.id=a.station_id JOIN stations sz ON sz.id=z.station_id`;
const bookable = `sc.status='SCHEDULED' AND sc.departure_at>UTC_TIMESTAMP(3)
  AND r.status='ACTIVE' AND sa.is_active=1 AND sz.is_active=1
  AND NOT EXISTS (SELECT 1 FROM route_stops rs JOIN stations st ON st.id=rs.station_id
    WHERE rs.route_id=r.id AND (st.is_active=0 OR rs.minutes_from_origin IS NULL))
  AND EXISTS (SELECT 1 FROM stations st WHERE st.id=r.origin_station_id AND st.is_active=1)
  AND EXISTS (SELECT 1 FROM stations st WHERE st.id=r.destination_station_id AND st.is_active=1)`;
const tripFields = `CAST(sc.id AS CHAR) AS id, CAST(r.id AS CHAR) AS route_id,
  r.code AS route_code, r.name AS route_name,
  CAST(sa.id AS CHAR) AS from_station_id, CAST(sz.id AS CHAR) AS to_station_id,
  sa.name AS from_station, sz.name AS to_station, v.vehicle_code, v.capacity,
  DATE_FORMAT(sc.departure_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS departure_at,
  DATE_FORMAT(TIMESTAMPADD(MINUTE,a.minutes_from_origin,sc.departure_at),'%Y-%m-%dT%H:%i:%s.%fZ') AS pickup_at,
  DATE_FORMAT(TIMESTAMPADD(MINUTE,z.minutes_from_origin,sc.departure_at),'%Y-%m-%dT%H:%i:%s.%fZ') AS dropoff_at,
  ROUND(4000+500*(z.km_from_origin-a.km_from_origin),0) AS unit_price,
  GREATEST(0,COALESCE((SELECT MIN(av.remaining) FROM v_segment_availability av
    WHERE av.schedule_id=sc.id AND av.segment_order>=a.stop_order AND av.segment_order<z.stop_order),0)) AS remaining`;

const displayStatus = `CASE WHEN b.status='CANCELLED' THEN 'CANCELLED'
  WHEN sc.status='COMPLETED' OR TIMESTAMPADD(MINUTE,z.minutes_from_origin,sc.departure_at)<=UTC_TIMESTAMP(3)
    THEN 'COMPLETED' ELSE 'CONFIRMED' END`;
const canCancel = `b.status='CONFIRMED' AND sc.status NOT IN ('COMPLETED','CANCELLED')
  AND TIMESTAMPADD(MINUTE,a.minutes_from_origin,sc.departure_at)>UTC_TIMESTAMP(3)`;
const ticketJoins = `FROM bookings b JOIN schedules sc ON sc.id=b.schedule_id
  JOIN routes r ON r.id=sc.route_id JOIN vehicles v ON v.id=sc.vehicle_id
  JOIN stations sa ON sa.id=b.from_station_id JOIN stations sz ON sz.id=b.to_station_id
  LEFT JOIN route_stops a ON a.route_id=r.id AND a.station_id=sa.id
  LEFT JOIN route_stops z ON z.route_id=r.id AND z.station_id=sz.id
  JOIN users u ON u.id=b.user_id`;
const ticketFields = `CAST(b.id AS CHAR) AS id, b.booking_code, CAST(b.user_id AS CHAR) AS user_id,
  CAST(b.schedule_id AS CHAR) AS schedule_id,
  CAST(b.from_station_id AS CHAR) AS from_station_id, CAST(b.to_station_id AS CHAR) AS to_station_id,
  b.passenger_name, b.contact_phone, u.email, b.unit_price, b.status,
  ${displayStatus} AS display_status, ${canCancel} AS can_cancel,
  r.code AS route_code, r.name AS route_name, sa.name AS from_station, sz.name AS to_station,
  v.vehicle_code, v.capacity,
  DATE_FORMAT(TIMESTAMPADD(MINUTE,a.minutes_from_origin,sc.departure_at),'%Y-%m-%dT%H:%i:%s.%fZ') AS pickup_at,
  DATE_FORMAT(TIMESTAMPADD(MINUTE,z.minutes_from_origin,sc.departure_at),'%Y-%m-%dT%H:%i:%s.%fZ') AS dropoff_at,
  DATE_FORMAT(b.booked_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS booked_at,
  DATE_FORMAT(b.cancelled_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS cancelled_at`;

type Schedule = {
  id: string;
  route_id: string;
  vehicle_id: string;
  status: string;
  future: number;
};
type Stop = {
  station_id: string;
  stop_order: number;
  km_from_origin: number | string;
  minutes_from_origin: number | null;
};

function validId(id: string) {
  if (!/^[1-9][0-9]{0,19}$/.test(id) || BigInt(id) > 18446744073709551615n)
    throw new BadRequestException('Mã vé, bến hoặc chuyến không hợp lệ.');
}
function validSegment(query: TripSegmentDto) {
  validId(query.from_station_id);
  validId(query.to_station_id);
  if (query.from_station_id === query.to_station_id)
    throw new BadRequestException('Điểm đi và điểm đến phải khác nhau.');
}
function normalizeTrip(row: Trip): Trip {
  return {
    ...row,
    capacity: Number(row.capacity),
    remaining: Number(row.remaining),
    unit_price: Number(row.unit_price),
  };
}
function normalizeTicket(row: Ticket): Ticket {
  return {
    ...row,
    capacity: Number(row.capacity),
    unit_price: Number(row.unit_price),
    can_cancel: Number(row.can_cancel) === 1,
  };
}
function requestPrefix(userId: string, requestId: string) {
  return `GB${createHash('sha256').update(`${userId}:${requestId}`).digest('hex').slice(0, 16)}-`;
}

@Injectable()
export class BookingsService {
  constructor(private readonly db: DataSource) {}

  async trips(query: TripSearchDto) {
    validSegment(query);
    if (query.route_id) validId(query.route_id);
    const start = dayStart(query.date);
    const clauses = [
      bookable,
      'TIMESTAMPADD(MINUTE,a.minutes_from_origin,sc.departure_at)>=?',
      'TIMESTAMPADD(MINUTE,a.minutes_from_origin,sc.departure_at)<?',
    ];
    const args: (string | number)[] = [
      query.from_station_id,
      query.to_station_id,
      sqlTime(start),
      sqlTime(start + 86400000),
    ];
    if (query.route_id) {
      clauses.push('r.id=?');
      args.push(query.route_id);
    }
    const where = clauses.join(' AND ');
    const [{ total }] = await this.db.query<{ total: number }[]>(
      `SELECT COUNT(*) AS total ${tripJoins} WHERE ${where}`,
      args,
    );
    const rows = await this.db.query<Trip[]>(
      `SELECT ${tripFields} ${tripJoins} WHERE ${where}
      ORDER BY pickup_at,sc.id LIMIT ? OFFSET ?`,
      [...args, query.limit, (query.page - 1) * query.limit],
    );
    return {
      items: rows.map(normalizeTrip),
      total: Number(total),
      page: query.page,
      totalPages: Math.ceil(Number(total) / query.limit),
    };
  }

  async trip(
    id: string,
    query: TripSegmentDto,
    manager: EntityManager = this.db.manager,
  ) {
    validId(id);
    validSegment(query);
    const [row] = await manager.query<Trip[]>(
      `SELECT ${tripFields} ${tripJoins}
      WHERE ${bookable} AND sc.id=?`,
      [query.from_station_id, query.to_station_id, id],
    );
    if (!row)
      throw new NotFoundException(
        'Chuyến không còn mở đặt vé hoặc chặng không hợp lệ.',
      );
    return normalizeTrip(row);
  }

  async list(userId: string, query: BookingListDto) {
    const where = `b.user_id=?${query.filter === 'ALL' ? '' : ` AND ${displayStatus}=?`}`;
    const args = query.filter === 'ALL' ? [userId] : [userId, query.filter];
    const [{ total }] = await this.db.query<{ total: number }[]>(
      `SELECT COUNT(*) AS total ${ticketJoins} WHERE ${where}`,
      args,
    );
    const rows = await this.db.query<Ticket[]>(
      `SELECT ${ticketFields} ${ticketJoins} WHERE ${where}
      ORDER BY b.booked_at DESC,b.id DESC LIMIT ? OFFSET ?`,
      [...args, query.limit, (query.page - 1) * query.limit],
    );
    return {
      items: rows.map(normalizeTicket),
      total: Number(total),
      page: query.page,
      totalPages: Math.ceil(Number(total) / query.limit),
    };
  }

  private async ticket(
    userId: string,
    id: string,
    manager: EntityManager = this.db.manager,
  ) {
    validId(id);
    const [row] = await manager.query<Ticket[]>(
      `SELECT ${ticketFields} ${ticketJoins}
      WHERE b.id=? AND b.user_id=?`,
      [id, userId],
    );
    if (!row) throw new NotFoundException('Không tìm thấy vé của bạn.');
    return normalizeTicket(row);
  }

  async detail(userId: string, id: string) {
    const ticket = await this.ticket(userId, id);
    const qr_data_url = await QRCode.toDataURL(ticket.booking_code, {
      width: 200,
      margin: 2,
      color: { dark: '#122e22', light: '#ffffff' },
    });
    return { ...ticket, qr_data_url };
  }

  async receipt(userId: string, requestId: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        requestId,
      )
    )
      throw new BadRequestException('Mã lần đặt vé không hợp lệ.');
    const rows = await this.db.query<Ticket[]>(
      `SELECT ${ticketFields} ${ticketJoins}
      WHERE b.user_id=? AND b.booking_code LIKE ? ORDER BY b.booking_code`,
      [userId, `${requestPrefix(userId, requestId)}%`],
    );
    if (!rows.length)
      throw new NotFoundException('Không tìm thấy lần đặt vé của bạn.');
    return rows.map(normalizeTicket);
  }

  private async transaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction('READ COMMITTED', work);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string }).code;
        if (
          [
            'ER_DUP_ENTRY',
            'ER_LOCK_DEADLOCK',
            'ER_LOCK_WAIT_TIMEOUT',
            'ER_NO_REFERENCED_ROW_2',
          ].includes(code ?? '')
        )
          throw new ConflictException(
            'Dữ liệu đang thay đổi. Vui lòng tải lại và thử lại.',
          );
      }
      throw error;
    }
  }

  async create(userId: string, body: CreateBookingDto) {
    validId(body.schedule_id);
    validSegment(body);
    // A repeat request produces the same short prefix, without a new DB column.
    const prefix = requestPrefix(userId, body.request_id);
    const [snapshot] = await this.db.query<Schedule[]>(
      `SELECT CAST(id AS CHAR) id,
      CAST(route_id AS CHAR) route_id,CAST(vehicle_id AS CHAR) vehicle_id FROM schedules WHERE id=?`,
      [body.schedule_id],
    );
    if (!snapshot) throw new NotFoundException('Không tìm thấy chuyến xe.');
    const beforeStops = await this.db.query<Stop[]>(
      `SELECT CAST(station_id AS CHAR) station_id FROM route_stops WHERE route_id=?`,
      [snapshot.route_id],
    );
    const [beforeRoute] = await this.db.query<
      { origin_station_id: string; destination_station_id: string }[]
    >(
      `SELECT CAST(origin_station_id AS CHAR) origin_station_id,CAST(destination_station_id AS CHAR) destination_station_id
       FROM routes WHERE id=?`,
      [snapshot.route_id],
    );
    if (!beforeRoute) throw new NotFoundException('Không tìm thấy tuyến xe.');
    const stationIds = [
      ...new Set([
        ...beforeStops.map((s) => s.station_id),
        beforeRoute.origin_station_id,
        beforeRoute.destination_station_id,
      ]),
    ].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));

    return this.transaction(async (manager) => {
      // Same lock order as station, route and schedule administration.
      for (const id of stationIds)
        await manager.query('SELECT id FROM stations WHERE id=? FOR UPDATE', [
          id,
        ]);
      const [route] = await manager.query<
        {
          status: string;
          origin_station_id: string;
          destination_station_id: string;
        }[]
      >(
        `SELECT status,CAST(origin_station_id AS CHAR) origin_station_id,CAST(destination_station_id AS CHAR) destination_station_id
         FROM routes WHERE id=? FOR UPDATE`,
        [snapshot.route_id],
      );
      const stops = await manager.query<Stop[]>(
        `SELECT CAST(station_id AS CHAR) station_id,stop_order,km_from_origin,minutes_from_origin
        FROM route_stops WHERE route_id=? ORDER BY stop_order FOR UPDATE`,
        [snapshot.route_id],
      );
      if (
        !route ||
        stops.some((s) => !stationIds.includes(s.station_id)) ||
        route.origin_station_id !== beforeRoute.origin_station_id ||
        route.destination_station_id !== beforeRoute.destination_station_id
      )
        throw new ConflictException(
          'Hành trình vừa thay đổi. Vui lòng chọn lại chuyến.',
        );
      await manager.query('SELECT id FROM vehicles WHERE id=? FOR UPDATE', [
        snapshot.vehicle_id,
      ]);
      const [schedule] = await manager.query<Schedule[]>(
        `SELECT CAST(id AS CHAR) id,CAST(route_id AS CHAR) route_id,
        CAST(vehicle_id AS CHAR) vehicle_id,status,departure_at>UTC_TIMESTAMP(3) AS future FROM schedules WHERE id=? FOR UPDATE`,
        [body.schedule_id],
      );
      if (
        !schedule ||
        schedule.route_id !== snapshot.route_id ||
        schedule.vehicle_id !== snapshot.vehicle_id
      )
        throw new ConflictException(
          'Chuyến vừa thay đổi. Vui lòng chọn lại chuyến.',
        );

      const existing = await manager.query<Ticket[]>(
        `SELECT CAST(id AS CHAR) id,booking_code,
        CAST(schedule_id AS CHAR) schedule_id,CAST(from_station_id AS CHAR) from_station_id,
        CAST(to_station_id AS CHAR) to_station_id,passenger_name,contact_phone,unit_price
        FROM bookings WHERE user_id=? AND booking_code LIKE ? ORDER BY booking_code FOR UPDATE`,
        [userId, `${prefix}%`],
      );
      if (existing.length) {
        const matches =
          existing.length === body.passengers.length &&
          existing.every(
            (ticket, index) =>
              ticket.schedule_id === body.schedule_id &&
              ticket.from_station_id === body.from_station_id &&
              ticket.to_station_id === body.to_station_id &&
              Number(ticket.unit_price) === body.unit_price &&
              ticket.passenger_name === body.passengers[index].passenger_name &&
              ticket.contact_phone === body.passengers[index].contact_phone,
          );
        if (!matches)
          throw new ConflictException(
            'Lần đặt này đã được ghi nhận với thông tin khác. Vui lòng xem Vé của tôi.',
          );
        return {
          ids: existing.map((ticket) => ticket.id),
          total_price: body.unit_price * existing.length,
        };
      }
      if (
        schedule.status !== 'SCHEDULED' ||
        Number(schedule.future) !== 1 ||
        route.status !== 'ACTIVE'
      )
        throw new ConflictException('Chuyến không còn mở đặt vé.');
      const [activeUser] = await manager.query<{ id: string }[]>(
        'SELECT id FROM users WHERE id=? AND is_active=1',
        [userId],
      );
      if (!activeUser)
        throw new ConflictException('Tài khoản không còn hoạt động.');
      const validStops =
        stops.length >= 2 &&
        stops.every(
          (stop, index) =>
            stop.stop_order === index + 1 &&
            stop.minutes_from_origin !== null &&
            (index === 0
              ? stop.minutes_from_origin === 0 &&
                Number(stop.km_from_origin) === 0
              : stop.minutes_from_origin! >
                  stops[index - 1].minutes_from_origin! &&
                Number(stop.km_from_origin) >
                  Number(stops[index - 1].km_from_origin)),
        );
      if (
        !validStops ||
        stops[0].station_id !== route.origin_station_id ||
        stops.at(-1)?.station_id !== route.destination_station_id
      )
        throw new ConflictException(
          'Hành trình chưa có đủ phút và khoảng cách hợp lệ để đặt vé.',
        );
      const quote = await this.trip(body.schedule_id, body, manager);
      if (quote.unit_price !== body.unit_price)
        throw new ConflictException(
          'Giá vé đã thay đổi. Vui lòng tải lại thông tin chuyến.',
        );
      if (body.passengers.length > quote.remaining)
        throw new ConflictException(
          `Chặng này chỉ còn ${quote.remaining} chỗ. Vui lòng giảm số vé hoặc chọn chuyến khác.`,
        );
      const ids: string[] = [];
      for (const [index, passenger] of body.passengers.entries()) {
        const code = `${prefix}${String(index + 1).padStart(5, '0')}`;
        await manager.query(
          `INSERT INTO bookings(booking_code,user_id,schedule_id,from_station_id,to_station_id,
          passenger_name,contact_phone,unit_price) VALUES(?,?,?,?,?,?,?,?)`,
          [
            code,
            userId,
            body.schedule_id,
            body.from_station_id,
            body.to_station_id,
            passenger.passenger_name,
            passenger.contact_phone,
            quote.unit_price,
          ],
        );
        const [{ id }] = await manager.query<{ id: string }[]>(
          'SELECT CAST(LAST_INSERT_ID() AS CHAR) id',
        );
        ids.push(id);
      }
      return { ids, total_price: quote.unit_price * ids.length };
    });
  }

  async cancel(userId: string, id: string) {
    const snapshot = await this.ticket(userId, id);
    return this.transaction(async (manager) => {
      // No parent locks after the schedule, avoiding inverted lock order.
      await manager.query('SELECT id FROM schedules WHERE id=? FOR UPDATE', [
        snapshot.schedule_id,
      ]);
      await manager.query(
        'SELECT id FROM bookings WHERE id=? AND user_id=? FOR UPDATE',
        [id, userId],
      );
      const ticket = await this.ticket(userId, id, manager);
      if (ticket.status === 'CANCELLED') return ticket;
      if (!ticket.can_cancel)
        throw new ConflictException(
          'Vé đã tới giờ đón hoặc chuyến đã kết thúc, không thể hủy.',
        );
      await manager.query(
        `UPDATE bookings SET status='CANCELLED',cancelled_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?`,
        [id, userId],
      );
      return this.ticket(userId, id, manager);
    });
  }
}

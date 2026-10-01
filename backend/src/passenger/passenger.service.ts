import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PassengerRoutesDto } from './passenger.dto.js';

// A passenger must never be offered a route containing an inactive station.
const available = `r.status='ACTIVE'
  AND EXISTS (SELECT 1 FROM route_stops rs WHERE rs.route_id=r.id)
  AND NOT EXISTS (SELECT 1 FROM route_stops rs JOIN stations s ON s.id=rs.station_id
    WHERE rs.route_id=r.id AND s.is_active=0)
  AND EXISTS (SELECT 1 FROM stations s WHERE s.id=r.origin_station_id AND s.is_active=1)
  AND EXISTS (SELECT 1 FROM stations s WHERE s.id=r.destination_station_id AND s.is_active=1)`;
type RouteRow = {
  id: string;
  code: string;
  name: string;
  origin_name: string;
  destination_name: string;
  operating_start: string;
  operating_end: string;
  distance_km: string | number;
};
type StopRow = {
  route_id: string;
  station_id: string;
  station_name: string;
  stop_order: number;
};

@Injectable()
export class PassengerService {
  constructor(private readonly db: DataSource) {}
  stations() {
    return this.db.query<{ id: string; code: string; name: string }[]>(
      `SELECT CAST(s.id AS CHAR) AS id, s.code, s.name FROM stations s
       WHERE s.is_active=1 AND EXISTS (
         SELECT 1 FROM route_stops chosen JOIN routes r ON r.id=chosen.route_id
         WHERE chosen.station_id=s.id AND ${available}) ORDER BY s.name, s.id`,
    );
  }
  async routes(query: PassengerRoutesDto) {
    const {
      from_station_id: from,
      to_station_id: to,
      route_id,
      page,
      limit,
    } = query;
    for (const id of [from, to, route_id]) {
      if (id && BigInt(id) > 18446744073709551615n)
        throw new BadRequestException('Mã bến hoặc tuyến không hợp lệ.');
    }
    if (Boolean(from) !== Boolean(to))
      throw new BadRequestException(
        'Vui lòng chọn cả điểm xuất phát và điểm đến.',
      );
    if (from && from === to)
      throw new BadRequestException(
        'Điểm xuất phát và điểm đến phải khác nhau.',
      );
    const clauses = [available];
    const args: string[] = [];
    if (from && to) {
      clauses.push(`EXISTS (SELECT 1 FROM route_stops a JOIN route_stops b
        ON b.route_id=a.route_id AND b.stop_order>a.stop_order
        WHERE a.route_id=r.id AND a.station_id=? AND b.station_id=?)`);
      args.push(from, to);
    }
    if (route_id) {
      clauses.push('r.id=?');
      args.push(route_id);
    }
    const where = clauses.join(' AND ');
    return this.db.transaction(async (manager) => {
      const [{ total }] = await manager.query<{ total: number }[]>(
        `SELECT COUNT(*) AS total FROM routes r WHERE ${where}`,
        args,
      );
      const routes = await manager.query<RouteRow[]>(
        `SELECT CAST(r.id AS CHAR) AS id, r.code, r.name, o.name AS origin_name,
          d.name AS destination_name, r.operating_start, r.operating_end, r.distance_km
         FROM routes r JOIN stations o ON o.id=r.origin_station_id
         JOIN stations d ON d.id=r.destination_station_id WHERE ${where}
         ORDER BY r.code,r.id LIMIT ? OFFSET ?`,
        [...args, limit, (page - 1) * limit],
      );
      const stops = routes.length
        ? await manager.query<StopRow[]>(
            `SELECT CAST(rs.route_id AS CHAR) AS route_id, CAST(s.id AS CHAR) AS station_id,
          s.name AS station_name, rs.stop_order
         FROM route_stops rs JOIN stations s ON s.id=rs.station_id
         WHERE rs.route_id IN (${routes.map(() => '?').join(',')}) ORDER BY rs.route_id,rs.stop_order`,
            routes.map((route) => route.id),
          )
        : [];
      return {
        items: routes.map((route) => ({
          ...route,
          distance_km: Number(route.distance_km),
          stops: stops
            .filter((stop) => stop.route_id === route.id)
            .map(({ route_id: _id, ...stop }) => stop),
        })),
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      };
    });
  }
}

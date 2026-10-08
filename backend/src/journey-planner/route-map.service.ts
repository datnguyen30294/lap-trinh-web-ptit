import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { RouteMapDto } from './dto/route-map.dto.js';
import { RoadRoutingService } from './road-routing.service.js';
import {
  readStoredGeometry,
  sliceRoad,
  stopSnapshot,
  type StoredRouteGeometry,
} from './route-geometry.js';

type StopRow = {
  id: string;
  code: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  stop_order: number;
};

@Injectable()
export class RouteMapService {
  private readonly logger = new Logger(RouteMapService.name);
  constructor(
    private readonly db: DataSource,
    private readonly roads: RoadRoutingService,
  ) {}

  async getMap(query: RouteMapDto) {
    for (const id of [
      query.route_id,
      query.from_station_id,
      query.to_station_id,
    ]) {
      if (BigInt(id) > 18446744073709551615n)
        throw new BadRequestException('Mã tuyến hoặc bến không hợp lệ.');
    }
    // One consistent snapshot, released BEFORE any external network call.
    const { route, rows } = await this.db.transaction(async (manager) => {
      const routes = await manager.query<{ geometry: unknown }[]>(
        `SELECT r.geometry FROM routes r
         JOIN stations origin ON origin.id=r.origin_station_id AND origin.is_active=1
         JOIN stations destination ON destination.id=r.destination_station_id AND destination.is_active=1
         WHERE r.id=? AND r.status='ACTIVE'
         AND NOT EXISTS (SELECT 1 FROM route_stops rs JOIN stations s ON s.id=rs.station_id
           WHERE rs.route_id=r.id AND s.is_active=0)`,
        [query.route_id],
      );
      const rows = routes.length
        ? await manager.query<StopRow[]>(
            `SELECT CAST(s.id AS CHAR) AS id,s.code,s.name,s.latitude,s.longitude,rs.stop_order
         FROM route_stops rs JOIN stations s ON s.id=rs.station_id WHERE rs.route_id=? ORDER BY rs.stop_order`,
            [query.route_id],
          )
        : [];
      return { route: routes[0], rows };
    });
    const from = rows.findIndex((s) => s.id === query.from_station_id);
    const to = rows.findIndex((s) => s.id === query.to_station_id);
    if (!route || from < 0 || to <= from)
      throw new NotFoundException(
        'Chặng tuyến không còn khả dụng. Vui lòng tìm lại lộ trình.',
      );
    if (
      rows.length > 100 ||
      rows.some((s) => s.latitude === null || s.longitude === null)
    )
      throw new UnprocessableEntityException(
        'Tuyến thiếu tọa độ hoặc vượt giới hạn 100 bến để vẽ bản đồ.',
      );
    const allStops = rows.map((s) => ({
      ...s,
      latitude: Number(s.latitude),
      longitude: Number(s.longitude),
    }));
    const stops = allStops.slice(from, to + 1);
    const cached = readStoredGeometry(route.geometry, allStops);
    if (cached)
      return {
        route_id: query.route_id,
        stops,
        geometry: sliceRoad(cached, from, to),
        source: 'database',
      };

    let road;
    try {
      road = await this.roads.route(allStops);
    } catch {
      // Never persist a straight line as street geometry; later requests can recover.
      return {
        route_id: query.route_id,
        stops,
        geometry: {
          type: 'LineString',
          coordinates: stops.map((s) => [s.longitude, s.latitude]),
        },
        source: 'straight-line',
        approximate: true,
      };
    }
    const stored: StoredRouteGeometry = {
      version: 1,
      source: 'osrm-driving',
      stops: stopSnapshot(allStops),
      ...road,
    };
    try {
      // Compare-and-set prevents concurrent requests overwriting newer geometry.
      // The stop snapshot invalidates this data after station/order edits.
      await this.db.query(
        'UPDATE routes SET geometry=? WHERE id=? AND geometry <=> CAST(? AS JSON)',
        [
          JSON.stringify(stored),
          query.route_id,
          route.geometry == null
            ? null
            : typeof route.geometry === 'string'
              ? route.geometry
              : JSON.stringify(route.geometry),
        ],
      );
    } catch {
      this.logger.warn(
        `Could not cache route geometry for route ${query.route_id}`,
      );
    }
    return {
      route_id: query.route_id,
      stops,
      geometry: sliceRoad(road, from, to),
      source: 'osrm-driving',
    };
  }
}

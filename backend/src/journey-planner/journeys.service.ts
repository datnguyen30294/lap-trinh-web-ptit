import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { JourneyDetailDto } from './dto/journey-detail.dto.js';
import { sqlTime } from '../schedules/schedule-time.js';
import type { SearchJourneysDto } from './dto/search-journeys.dto.js';
import {
  distanceMeters,
  endOfVietnamDay,
  MAX_WALKING_DISTANCE_M,
  nextPickup,
  walkingMinutes,
  type JourneySchedule,
} from './journey-calculation.js';

type BoardingOption = {
  route_id: string;
  route_code: string;
  route_name: string;
  station_id: string;
  station_name: string;
  station_address: string;
  latitude: string;
  longitude: string;
  stop_order: number;
  boarding_offset: number;
  destination_offset: number;
  distance_km: string;
  fare_vnd: string;
};

@Injectable()
export class JourneysService {
  constructor(private readonly db: DataSource) {}

  async search(query: SearchJourneysDto) {
    return this.db.transaction((manager) => this.findJourneys(manager, query));
  }

  async detail(query: JourneyDetailDto) {
    if (BigInt(query.route_id) > 18446744073709551615n)
      throw new BadRequestException('Mã tuyến không hợp lệ.');
    return this.db.transaction(async (manager) => {
      const result = await this.findJourneys(manager, query);
      const journey = result.items.find(
        (item) => item.route_id === query.route_id,
      );
      if (!journey)
        throw new NotFoundException(
          'Tuyến này không còn chuyến đón phù hợp. Vui lòng tìm lại lộ trình.',
        );
      const stops = await manager.query<
        {
          id: string;
          name: string;
          address: string;
          stop_order: number;
          latitude: string;
          longitude: string;
        }[]
      >(
        `SELECT CAST(s.id AS CHAR) AS id,s.name,s.address,s.latitude,s.longitude,rs.stop_order
         FROM route_stops rs JOIN stations s ON s.id=rs.station_id
         JOIN route_stops a ON a.route_id=rs.route_id AND a.station_id=?
         JOIN route_stops z ON z.route_id=rs.route_id AND z.station_id=?
         WHERE rs.route_id=? AND rs.stop_order BETWEEN a.stop_order AND z.stop_order
         ORDER BY rs.stop_order`,
        [
          journey.boarding_station.id,
          query.destination_station_id,
          query.route_id,
        ],
      );
      return {
        ...journey,
        alighting_station: {
          ...stops[stops.length - 1],
          latitude: Number(stops[stops.length - 1].latitude),
          longitude: Number(stops[stops.length - 1].longitude),
        },
        stops,
        stop_count: stops.length - 1,
        // The destination picker currently selects a station, not an arbitrary address.
        walking_after_m: 0,
        walking_after_minutes: 0,
        updated_at: result.searched_at,
      };
    });
  }

  private async findJourneys(manager: EntityManager, query: SearchJourneysDto) {
    if (BigInt(query.destination_station_id) > 18446744073709551615n)
      throw new BadRequestException('Mã điểm đến không hợp lệ.');
    const now = Date.now();
    const destinations = await manager.query<{ id: string }[]>(
      `SELECT CAST(id AS CHAR) AS id FROM stations WHERE id=? AND is_active=1
         AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [query.destination_station_id],
    );
    if (!destinations.length)
      throw new NotFoundException(
        'Điểm đến không còn khả dụng. Vui lòng chọn lại.',
      );

    // Direction matters: the boarding stop must precede the chosen destination.
    const stops = await manager.query<BoardingOption[]>(
      `SELECT CAST(r.id AS CHAR) AS route_id, r.code AS route_code, r.name AS route_name,
           CAST(s.id AS CHAR) AS station_id, s.name AS station_name, s.address AS station_address,
           s.latitude, s.longitude, a.stop_order, a.minutes_from_origin AS boarding_offset,
           z.minutes_from_origin AS destination_offset,
           z.km_from_origin-a.km_from_origin AS distance_km,
           ROUND(4000+500*(z.km_from_origin-a.km_from_origin),0) AS fare_vnd
         FROM route_stops z JOIN routes r ON r.id=z.route_id
         JOIN route_stops a ON a.route_id=r.id AND a.stop_order<z.stop_order
         JOIN stations s ON s.id=a.station_id
         JOIN stations origin ON origin.id=r.origin_station_id AND origin.is_active=1
         JOIN stations destination ON destination.id=r.destination_station_id AND destination.is_active=1
         WHERE z.station_id=? AND r.status='ACTIVE' AND s.is_active=1
           AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
           AND z.km_from_origin>a.km_from_origin
           AND a.minutes_from_origin IS NOT NULL AND z.minutes_from_origin>a.minutes_from_origin
           AND NOT EXISTS (SELECT 1 FROM route_stops rs JOIN stations st ON st.id=rs.station_id
             WHERE rs.route_id=r.id AND st.is_active=0)
         ORDER BY r.id,a.stop_order`,
      [query.destination_station_id],
    );
    const nearby = stops
      .map((stop) => ({
        ...stop,
        meters: distanceMeters(
          query.latitude,
          query.longitude,
          Number(stop.latitude),
          Number(stop.longitude),
        ),
      }))
      .filter((stop) => stop.meters <= MAX_WALKING_DISTANCE_M)
      .sort((a, b) => a.meters - b.meters || a.stop_order - b.stop_order);
    const routeIds = [...new Set(nearby.map((stop) => stop.route_id))];
    const schedules = routeIds.length
      ? await manager.query<JourneySchedule[]>(
          `SELECT CAST(id AS CHAR) AS id, CAST(route_id AS CHAR) AS route_id,
           DATE_FORMAT(departure_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS departure_at,
           DATE_FORMAT(arrival_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS arrival_at
         FROM schedules WHERE route_id IN (${routeIds.map(() => '?').join(',')})
           AND status IN ('SCHEDULED','DEPARTED') AND arrival_at>=? AND departure_at<?
         ORDER BY departure_at,id`,
          [...routeIds, sqlTime(now), sqlTime(endOfVietnamDay(now))],
        )
      : [];

    const items: Array<{
      route_id: string;
      route_code: string;
      route_name: string;
      boarding_station: {
        id: string;
        name: string;
        address: string;
        latitude: number;
        longitude: number;
      };
      walking_distance_m: number;
      walking_minutes: number;
      ride_minutes: number;
      distance_km: number;
      fare_vnd: number;
      total_minutes: number;
      wait_minutes: number;
      schedule_id: string;
      pickup_at: string;
      dropoff_at: string;
    }> = [];
    const included = new Set<string>();
    for (const stop of nearby) {
      if (included.has(stop.route_id)) continue;
      const walk = walkingMinutes(stop.meters);
      const pickup = nextPickup(
        schedules.filter((schedule) => schedule.route_id === stop.route_id),
        now,
        walk,
        stop.boarding_offset,
        stop.destination_offset,
      );
      if (!pickup) continue;
      const ride = stop.destination_offset - stop.boarding_offset;
      items.push({
        route_id: stop.route_id,
        route_code: stop.route_code,
        route_name: stop.route_name,
        boarding_station: {
          id: stop.station_id,
          name: stop.station_name,
          address: stop.station_address,
          latitude: Number(stop.latitude),
          longitude: Number(stop.longitude),
        },
        walking_distance_m: Math.round(stop.meters),
        walking_minutes: walk,
        ride_minutes: ride,
        distance_km: Number(stop.distance_km),
        fare_vnd: Number(stop.fare_vnd),
        ...pickup,
        total_minutes: walk + pickup.wait_minutes + ride,
      });
      included.add(stop.route_id);
    }
    items.sort(
      (a, b) =>
        a.total_minutes - b.total_minutes ||
        a.walking_distance_m - b.walking_distance_m ||
        a.route_code.localeCompare(b.route_code),
    );
    return {
      items,
      searched_at: new Date(now).toISOString(),
      max_walking_distance_m: MAX_WALKING_DISTANCE_M,
    };
  }
}

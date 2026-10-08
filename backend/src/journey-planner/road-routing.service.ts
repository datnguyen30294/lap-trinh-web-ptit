import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  roadFromLegs,
  type IndexedRoad,
  type RoadGeometry,
} from './route-geometry.js';

@Injectable()
export class RoadRoutingService {
  private nextRequestAt = 0;
  private readonly cache = new Map<
    string,
    { expires: number; geometry: IndexedRoad }
  >();
  private readonly pending = new Map<string, Promise<IndexedRoad>>();

  async route(points: { latitude: number; longitude: number }[]) {
    // Cache by ordered coordinates: changing a stop invalidates its old geometry.
    const key = points
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(';');
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.geometry;
    const pending = this.pending.get(key);
    if (pending) return pending;
    // Bound work against the shared demo provider as well as memory usage.
    if (this.pending.size >= 4)
      throw new ServiceUnavailableException(
        'Đường đi đang bận, vui lòng thử lại.',
      );
    const request = this.fetchGeometry(key);
    this.pending.set(key, request);
    try {
      const geometry = await request;
      if (this.cache.size >= 100)
        this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { geometry, expires: Date.now() + 3600000 });
      return geometry;
    } finally {
      this.pending.delete(key);
    }
  }

  private async fetchGeometry(coordinates: string): Promise<IndexedRoad> {
    try {
      // Public OSRM demo policy: at most one new request per second.
      const startAt = Math.max(Date.now(), this.nextRequestAt);
      this.nextRequestAt = startAt + 1100;
      const delay = startAt - Date.now();
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&geometries=geojson&steps=true&alternatives=false&radiuses=${coordinates
          .split(';')
          .map(() => '500')
          .join(';')}`,
        {
          signal: AbortSignal.timeout(4000),
          headers: { 'User-Agent': 'GoBus-Student-Demo/1.0' },
        },
      );
      if (!response.ok) throw new Error('Routing provider unavailable');
      const body = (await response.json()) as {
        code?: string;
        routes?: { legs: { steps: { geometry: RoadGeometry }[] }[] }[];
      };
      if (body.code !== 'Ok' || !body.routes?.[0])
        throw new Error('Invalid road response');
      return roadFromLegs(body.routes[0].legs, coordinates.split(';').length);
    } catch {
      throw new ServiceUnavailableException(
        'Chưa tải được đường đi. Vui lòng thử lại.',
      );
    }
  }
}

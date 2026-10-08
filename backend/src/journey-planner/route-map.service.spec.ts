import { expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import type { RoadRoutingService } from './road-routing.service.js';
import { RouteMapService } from './route-map.service.js';
import { stopSnapshot } from './route-geometry.js';

const query = { route_id: '1', from_station_id: '2', to_station_id: '4' };
const rows = [1, 2, 3, 4, 5].map((id) => ({
  id: String(id),
  code: `S${id}`,
  name: `Stop ${id}`,
  latitude: '21.02',
  longitude: (105.84 + id / 1000).toFixed(7),
  stop_order: id,
}));
const stops = rows.map((s) => ({
  ...s,
  latitude: Number(s.latitude),
  longitude: Number(s.longitude),
}));
const road = {
  geometry: {
    type: 'LineString',
    coordinates: stops.flatMap((s, i) =>
      i === 4
        ? [[s.longitude, s.latitude]]
        : [
            [s.longitude, s.latitude],
            [s.longitude + 0.0005, 21.0202],
          ],
    ),
  },
  stop_indices: [0, 2, 4, 6, 8],
};
const stored = {
  version: 1,
  source: 'osrm-driving',
  stops: stopSnapshot(stops),
  ...road,
};

function setup(geometry: unknown = null, value = rows) {
  const manager = {
    query: vi
      .fn()
      .mockResolvedValueOnce([{ geometry }])
      .mockResolvedValueOnce(value),
  };
  const db = {
    transaction: vi.fn(async (fn) => fn(manager)),
    query: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  };
  const roads = { route: vi.fn().mockResolvedValue(road) };
  return {
    db,
    roads,
    service: new RouteMapService(
      db as unknown as DataSource,
      roads as unknown as RoadRoutingService,
    ),
  };
}

it('reads and slices DB geometry with no routing request or write', async () => {
  const { service, roads, db } = setup(stored);
  const result = await service.getMap(query);
  expect(result.source).toBe('database');
  expect(result.stops.map((s) => s.id)).toEqual(['2', '3', '4']);
  expect(result.geometry.coordinates).toEqual(
    road.geometry.coordinates.slice(2, 7),
  );
  expect(roads.route).not.toHaveBeenCalled();
  expect(db.query).not.toHaveBeenCalled();
});
it('requests the full route, stores its indexed geometry and returns only the requested segment', async () => {
  const { service, roads, db } = setup();
  const result = await service.getMap(query);
  expect(roads.route).toHaveBeenCalledWith(stops);
  expect(result.source).toBe('osrm-driving');
  expect(result.geometry.coordinates).toEqual(
    road.geometry.coordinates.slice(2, 7),
  );
  expect(JSON.parse(db.query.mock.calls[0][1][0])).toEqual(stored);
  expect(db.query.mock.calls[0][1][2]).toBeNull();
});
it.each([
  {},
  { ...stored, stops: stored.stops.toReversed() },
  { ...stored, stop_indices: [0, 4, 2, 6, 8] },
  { ...stored, stops: stored.stops.map((s) => ({ ...s, latitude: 22 })) },
])(
  'regenerates corrupt or stale geometry after stop changes',
  async (geometry) => {
    const { service, roads } = setup(geometry);
    expect((await service.getMap(query)).source).toBe('osrm-driving');
    expect(roads.route).toHaveBeenCalledOnce();
  },
);
it('returns a labeled line through every segment stop on timeout and does not persist it', async () => {
  const { service, roads, db } = setup();
  roads.route.mockRejectedValue(new Error('timeout'));
  const result = await service.getMap(query);
  expect(result.source).toBe('straight-line');
  expect(result.geometry.coordinates).toEqual(
    stops.slice(1, 4).map((s) => [s.longitude, s.latitude]),
  );
  expect(db.query).not.toHaveBeenCalled();
});
it('still serves successful geometry if cache persistence fails', async () => {
  const { service, db } = setup();
  db.query.mockRejectedValue(new Error('DB write failed'));
  expect((await service.getMap(query)).source).toBe('osrm-driving');
});
it('rejects unavailable or reversed segments before requesting roads', async () => {
  const { service, roads } = setup(null, []);
  await expect(service.getMap(query)).rejects.toThrow('không còn khả dụng');
  expect(roads.route).not.toHaveBeenCalled();
  await expect(
    setup().service.getMap({
      ...query,
      from_station_id: '4',
      to_station_id: '2',
    }),
  ).rejects.toThrow('không còn khả dụng');
});
it('does not silently skip missing intermediate coordinates', async () => {
  const { service, roads } = setup(
    null,
    rows.map((s) =>
      s.id === '3' ? { ...s, latitude: null } : s,
    ) as typeof rows,
  );
  await expect(service.getMap(query)).rejects.toThrow('thiếu tọa độ');
  expect(roads.route).not.toHaveBeenCalled();
});

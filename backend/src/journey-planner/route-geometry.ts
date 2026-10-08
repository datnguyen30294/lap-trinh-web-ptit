export type RoadGeometry = { type: 'LineString'; coordinates: number[][] };
export type IndexedRoad = { geometry: RoadGeometry; stop_indices: number[] };
export type GeometryStop = {
  code: string;
  latitude: number;
  longitude: number;
  stop_order: number;
};
export type StoredRouteGeometry = IndexedRoad & {
  version: 1;
  source: 'osrm-driving';
  stops: GeometryStop[];
};

export function isRoadGeometry(value: unknown): value is RoadGeometry {
  const geometry = value as RoadGeometry | undefined;
  return (
    geometry?.type === 'LineString' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2 &&
    geometry.coordinates.length <= 100000 &&
    geometry.coordinates.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        Math.abs(p[0]) <= 180 &&
        Math.abs(p[1]) <= 90,
    )
  );
}

export function stopSnapshot(stops: GeometryStop[]): GeometryStop[] {
  return stops.map(({ code, latitude, longitude, stop_order }) => ({
    code,
    latitude,
    longitude,
    stop_order,
  }));
}

// Store exact leg boundaries. Nearest-point slicing is ambiguous on loops and crossings.
export function roadFromLegs(
  legs: { steps: { geometry: RoadGeometry }[] }[],
  stopCount: number,
): IndexedRoad {
  if (!Array.isArray(legs) || legs.length !== stopCount - 1)
    throw new Error('Invalid route legs');
  const coordinates: number[][] = [];
  const stop_indices = [0];
  for (const leg of legs) {
    if (!Array.isArray(leg.steps) || !leg.steps.length)
      throw new Error('Missing route steps');
    for (const step of leg.steps) {
      if (!isRoadGeometry(step.geometry))
        throw new Error('Invalid step geometry');
      for (const point of step.geometry.coordinates) {
        const last = coordinates.at(-1);
        if (!last || last[0] !== point[0] || last[1] !== point[1])
          coordinates.push(point);
      }
    }
    // Two nearby stations can snap to the same road point.
    if (coordinates.length - 1 === stop_indices.at(-1))
      coordinates.push([...coordinates.at(-1)!]);
    stop_indices.push(coordinates.length - 1);
  }
  const geometry: RoadGeometry = { type: 'LineString', coordinates };
  if (!isRoadGeometry(geometry)) throw new Error('Invalid route geometry');
  return { geometry, stop_indices };
}

export function readStoredGeometry(
  value: unknown,
  stops: GeometryStop[],
): StoredRouteGeometry | null {
  try {
    const stored = (
      typeof value === 'string' ? JSON.parse(value) : value
    ) as StoredRouteGeometry;
    if (
      !stored ||
      stored.version !== 1 ||
      stored.source !== 'osrm-driving' ||
      !isRoadGeometry(stored.geometry) ||
      !Array.isArray(stored.stops) ||
      stored.stops.length !== stops.length ||
      !Array.isArray(stored.stop_indices) ||
      stored.stop_indices.length !== stops.length
    )
      return null;
    if (
      !stops.every((s, i) => {
        const old = stored.stops[i];
        const index = stored.stop_indices[i];
        return (
          old?.code === s.code &&
          old.latitude === s.latitude &&
          old.longitude === s.longitude &&
          old.stop_order === s.stop_order &&
          Number.isInteger(index) &&
          index >= 0 &&
          index < stored.geometry.coordinates.length &&
          (i === 0 || index > stored.stop_indices[i - 1])
        );
      })
    )
      return null;
    if (
      stored.stop_indices[0] !== 0 ||
      stored.stop_indices.at(-1) !== stored.geometry.coordinates.length - 1
    )
      return null;
    return stored;
  } catch {
    return null;
  }
}

export function sliceRoad(
  road: IndexedRoad,
  from: number,
  to: number,
): RoadGeometry {
  return {
    type: 'LineString',
    coordinates: road.geometry.coordinates.slice(
      road.stop_indices[from],
      road.stop_indices[to] + 1,
    ),
  };
}

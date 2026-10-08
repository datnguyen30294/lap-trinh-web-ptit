import { request } from './stationsApi';

export const journeyPlannerApi = {
  tracking: (signal) => request('/journey-planner/tracking', { signal }),
  startTracking: (position, destinationId, routeId) =>
    request('/journey-planner/tracking', {
      method: 'POST',
      body: {
        latitude: position.latitude,
        longitude: position.longitude,
        destination_station_id: destinationId,
        route_id: routeId,
        ...(position.label ? { origin_label: position.label } : {}),
      },
    }),
  endTracking: (id) =>
    request(`/journey-planner/tracking/${id}/end`, { method: 'POST' }),
  detail: (position, destinationId, routeId, signal) =>
    request(
      `/journey-planner/journeys/detail?${new URLSearchParams({
        latitude: String(position.latitude),
        longitude: String(position.longitude),
        destination_station_id: destinationId,
        route_id: routeId,
      })}`,
      { signal },
    ),
  routeMap: (routeId, fromId, toId, signal) =>
    request(
      `/journey-planner/route-map?${new URLSearchParams({
        route_id: routeId,
        from_station_id: fromId,
        to_station_id: toId,
      })}`,
      { signal },
    ),
  search: (position, destinationId, signal) =>
    request(
      `/journey-planner/journeys?${new URLSearchParams({
        latitude: String(position.latitude),
        longitude: String(position.longitude),
        destination_station_id: destinationId,
      })}`,
      { signal },
    ),
  places: (search, signal) =>
    request(
      `/journey-planner/places?${new URLSearchParams({ search, limit: '8' })}`,
      { signal },
    ),
};

import { request } from './stationsApi';

const queryString = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== undefined,
    ),
  );

export const bookingsApi = {
  trips: (params, signal) =>
    request(`/bookings/trips?${queryString(params)}`, { signal }),
  trip: (id, params, signal) =>
    request(`/bookings/trips/${id}?${queryString(params)}`, { signal }),
  create: (body) => request('/bookings', { method: 'POST', body }),
  list: (params, signal) =>
    request(`/bookings?${queryString(params)}`, { signal }),
  detail: (id, signal) => request(`/bookings/${id}`, { signal }),
  receipt: (requestId, signal) =>
    request(`/bookings/receipt/${requestId}`, { signal }),
  cancel: (id) => request(`/bookings/${id}/cancel`, { method: 'PATCH' }),
};

import { request } from './stationsApi';

export const passengerApi = {
  stations: (signal) => request('/passenger/stations', { signal }),
  routes: (params = {}, signal) =>
    request(`/passenger/routes?${new URLSearchParams(params)}`, { signal }),
};

import { request } from './stationsApi';
export const routesApi = {
  list: (params, signal) =>
    request(
      `/routes?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== ''))}`,
      { signal },
    ),
  detail: (id, signal) => request(`/routes/${id}`, { signal }),
  create: (body) => request('/routes', { method: 'POST', body }),
  update: (id, body) => request(`/routes/${id}`, { method: 'PATCH', body }),
  setStatus: (id, status) =>
    request(`/routes/${id}/status`, { method: 'PATCH', body: { status } }),
};

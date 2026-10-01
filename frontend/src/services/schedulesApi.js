import { request } from './stationsApi';
const query = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined),
  );
export const schedulesApi = {
  list: (params, signal) => request(`/schedules?${query(params)}`, { signal }),
  vehicles: (params, signal) =>
    request(`/schedules/vehicles?${query(params)}`, { signal }),
  detail: (id, signal) => request(`/schedules/${id}`, { signal }),
  create: (body) => request('/schedules', { method: 'POST', body }),
  update: (id, body) => request(`/schedules/${id}`, { method: 'PATCH', body }),
  setStatus: (id, status) =>
    request(`/schedules/${id}/status`, { method: 'PATCH', body: { status } }),
};
export async function allPages(list, signal) {
  const items = [];
  let page = 1,
    data;
  do {
    data = await list({ page, limit: 100 }, signal);
    items.push(...data.items);
    page++;
  } while (page <= data.totalPages);
  return items;
}

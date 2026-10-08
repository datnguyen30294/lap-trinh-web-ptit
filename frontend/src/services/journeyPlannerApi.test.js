import { afterEach, expect, it, vi } from 'vitest';
import { journeyPlannerApi } from './journeyPlannerApi';

afterEach(() => vi.unstubAllGlobals());

it('starts and ends tracking with authenticated POST requests and only trusted input fields', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ active: null }) });
  vi.stubGlobal('fetch', fetch);
  await journeyPlannerApi.startTracking(
    { latitude: 21, longitude: 105, isDemo: true },
    '5',
    '2',
  );
  expect(fetch.mock.calls[0][0]).toBe('/api/journey-planner/tracking');
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: 'POST',
    credentials: 'include',
    headers: { 'X-GoBus-Request': '1' },
  });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    latitude: 21,
    longitude: 105,
    destination_station_id: '5',
    route_id: '2',
  });
  await journeyPlannerApi.endTracking('id');
  expect(fetch.mock.calls[1][0]).toBe('/api/journey-planner/tracking/id/end');
  expect(fetch.mock.calls[1][1].method).toBe('POST');
});

it('loads route detail using IDs and origin with the current session, without a client supplied fare', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ route_id: '12' }) });
  vi.stubGlobal('fetch', fetch);
  const signal = new AbortController().signal;
  await journeyPlannerApi.detail(
    { latitude: 21.004, longitude: 105.8195 },
    '5',
    '12',
    signal,
  );
  const [path, options] = fetch.mock.calls[0];
  const url = new URL(path, 'http://localhost');
  expect(url.pathname).toBe('/api/journey-planner/journeys/detail');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    latitude: '21.004',
    longitude: '105.8195',
    destination_station_id: '5',
    route_id: '12',
  });
  expect(options).toMatchObject({ credentials: 'include', signal });
});

it('sends real position coordinates and the selected station to the authenticated journey API', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
  vi.stubGlobal('fetch', fetch);
  const signal = new AbortController().signal;
  await journeyPlannerApi.search(
    { latitude: 21.02755, longitude: 105.84968, accuracy: 50 },
    '24',
    signal,
  );
  const [path, options] = fetch.mock.calls[0];
  const url = new URL(path, 'http://localhost');
  expect(url.pathname).toBe('/api/journey-planner/journeys');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    latitude: '21.02755',
    longitude: '105.84968',
    destination_station_id: '24',
  });
  expect(options).toMatchObject({ credentials: 'include', signal });
});

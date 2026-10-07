import { afterEach, expect, it, vi } from 'vitest';
import { searchAddresses } from './geocodingService';
afterEach(() => vi.unstubAllGlobals());

it('passes explicit address searches and abort signals through the authenticated backend', async () => {
  const items = [{ name: 'Hồ Gươm', latitude: 21.028, longitude: 105.852 }];
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ items }) });
  vi.stubGlobal('fetch', fetch);
  const signal = new AbortController().signal;
  expect(await searchAddresses('  Hồ Gươm  ', signal)).toEqual(items);
  const [path, options] = fetch.mock.calls[0];
  const url = new URL(path, 'http://localhost');
  expect(url.pathname).toBe('/api/journey-planner/geocoding');
  expect(url.searchParams.get('search')).toBe('Hồ Gươm');
  expect(options).toMatchObject({ signal, credentials: 'include' });
});

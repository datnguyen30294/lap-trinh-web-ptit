import { ConfigService } from '@nestjs/config';
import { afterEach, expect, it, vi } from 'vitest';
import { GeocodingService } from './geocoding.service.js';

const result = {
  display_name: 'Hồ Gươm, Hà Nội',
  lat: '21.028',
  lon: '105.852',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('bounds Hanoi, identifies the app and normalizes only valid in-region results', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => [
        result,
        { ...result, lat: '10.8' },
        { ...result, lon: 'bad' },
        null,
      ],
    });
  vi.stubGlobal('fetch', fetch);
  const service = new GeocodingService(new ConfigService());
  expect(await service.search('Hồ Gươm')).toEqual([
    { name: result.display_name, latitude: 21.028, longitude: 105.852 },
  ]);
  const [url, options] = fetch.mock.calls[0];
  expect(url.hostname).toBe('nominatim.openstreetmap.org');
  expect(url.searchParams.get('bounded')).toBe('1');
  expect(url.searchParams.get('countrycodes')).toBe('vn');
  expect(url.searchParams.get('viewbox')).toBe('105.65,21.15,105.95,20.90');
  expect(url.searchParams.get('q')).toContain('Hà Nội');
  expect(options.headers['User-Agent']).toContain('GoBus');
  await service.search('  HỒ GƯƠM  ');
  expect(fetch).toHaveBeenCalledOnce();
});

it('coalesces identical searches and limits all clients to one provider request per second', async () => {
  vi.useFakeTimers();
  const starts: number[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      starts.push(Date.now());
      return { ok: true, json: async () => [result] };
    }),
  );
  const service = new GeocodingService(new ConfigService());
  const first = service.search('Hồ Gươm');
  const same = service.search('Hồ Gươm');
  const second = service.search('Bách Khoa');
  await vi.advanceTimersByTimeAsync(1100);
  await Promise.all([first, same, second]);
  expect(starts).toHaveLength(2);
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
});

it('does not cache provider errors and permits a later retry', async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal('fetch', fetch);
  const service = new GeocodingService(new ConfigService());
  await expect(service.search('Bách Khoa')).rejects.toThrow(
    'Chưa tìm được địa chỉ',
  );
  const retry = service.search('Bách Khoa');
  await vi.advanceTimersByTimeAsync(1100);
  expect(await retry).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(2);
});

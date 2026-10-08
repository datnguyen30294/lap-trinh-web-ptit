import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoadRoutingService } from './road-routing.service.js';

const points = [
  { latitude: 21.02655, longitude: 105.84968 },
  { latitude: 21.024, longitude: 105.841 },
];
const geometry = {
  type: 'LineString',
  coordinates: [
    [105.84968, 21.02655],
    [105.841, 21.024],
  ],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Road routing', () => {
  it('spaces different public routing requests at least one second apart', async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        starts.push(Date.now());
        return {
          ok: true,
          json: async () => ({
            code: 'Ok',
            routes: [{ legs: [{ steps: [{ geometry }] }] }],
          }),
        };
      }),
    );
    const roads = new RoadRoutingService();
    const first = roads.route(points);
    const second = roads.route([...points].reverse());
    await vi.advanceTimersByTimeAsync(1100);
    await Promise.all([first, second]);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
  });
  it('uses ordered longitude/latitude, caches successes and separates reversed directions', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ legs: [{ steps: [{ geometry }] }] }],
      }),
    });
    vi.stubGlobal('fetch', fetch);
    const roads = new RoadRoutingService();
    expect(await roads.route(points)).toEqual({
      geometry,
      stop_indices: [0, 1],
    });
    await roads.route(points);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain(
      '/driving/105.84968,21.02655;105.841,21.024?',
    );
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    await roads.route([...points].reverse());
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('coalesces concurrent requests for the same segment', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ legs: [{ steps: [{ geometry }] }] }],
      }),
    });
    vi.stubGlobal('fetch', fetch);
    const roads = new RoadRoutingService();
    await Promise.all([roads.route(points), roads.route(points)]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not cache failures and allows a later retry', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [{ legs: [{ steps: [{ geometry }] }] }],
        }),
      });
    vi.stubGlobal('fetch', fetch);
    const roads = new RoadRoutingService();
    await expect(roads.route(points)).rejects.toThrow('Chưa tải được đường đi');
    expect(await roads.route(points)).toEqual({
      geometry,
      stop_indices: [0, 1],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([
    { code: 'NoRoute' },
    {
      code: 'Ok',
      routes: [
        {
          geometry: {
            type: 'LineString',
            coordinates: [
              [181, 21],
              [105, 22],
            ],
          },
        },
      ],
    },
    {
      code: 'Ok',
      routes: [{ geometry: { type: 'Point', coordinates: [105, 21] } }],
    },
  ])('rejects an unusable road response', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
    );
    await expect(new RoadRoutingService().route(points)).rejects.toThrow(
      'Chưa tải được đường đi',
    );
  });
});

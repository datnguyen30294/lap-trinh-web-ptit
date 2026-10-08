import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useJourneyTracking } from './useJourneyTracking';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';

vi.mock('../../services/journeyPlannerApi', () => ({
  journeyPlannerApi: {
    tracking: vi.fn(),
    startTracking: vi.fn(),
    endTracking: vi.fn(),
  },
}));
const active = {
  id: 'one',
  origin: { latitude: 21, longitude: 105 },
  journey: { route_id: '2' },
  step: 1,
};
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it('polls progress without replacing map coordinates and stops polling after unmount', async () => {
  vi.useFakeTimers();
  journeyPlannerApi.tracking
    .mockResolvedValueOnce({ active })
    .mockResolvedValue({ active: { ...structuredClone(active), step: 2 } });
  const view = renderHook(() => useJourneyTracking());
  await act(async () => {});
  const origin = view.result.current.data.origin;
  const journey = view.result.current.data.journey;
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(view.result.current.data.step).toBe(2);
  expect(view.result.current.data.origin).toBe(origin);
  expect(view.result.current.data.journey).toBe(journey);
  view.unmount();
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(journeyPlannerApi.tracking).toHaveBeenCalledTimes(2);
});

it('does not restore an ended journey from a late polling response', async () => {
  vi.useFakeTimers();
  let finish;
  journeyPlannerApi.tracking
    .mockResolvedValueOnce({ active })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  journeyPlannerApi.endTracking.mockResolvedValue({ ended: true });
  const view = renderHook(() => useJourneyTracking());
  await act(async () => {});
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  const signal = journeyPlannerApi.tracking.mock.calls[1][0];
  await act(async () => view.result.current.end());
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ active }));
  expect(view.result.current.data).toBeNull();
});

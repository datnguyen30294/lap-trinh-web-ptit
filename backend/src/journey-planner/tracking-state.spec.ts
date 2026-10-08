import { expect, it } from 'vitest';
import { trackingState, type ActiveJourney } from './tracking-state.js';

const active = {
  id: 'session-journey',
  started_at: '2035-01-01T01:00:00Z',
  journey: {
    walking_minutes: 3,
    pickup_at: '2035-01-01T01:06:00Z',
    dropoff_at: '2035-01-01T01:15:00Z',
  },
} as ActiveJourney;
it.each([
  [0, 1, 360],
  [3, 2, 180],
  [6, 3, 0],
  [15, 4, 0],
  [20, 4, 0],
])(
  'derives step at elapsed minute %s without negative countdowns',
  (minutes, step, pickup) => {
    const result = trackingState(
      active,
      Date.parse(active.started_at) + minutes * 60000,
    );
    expect(result.step).toBe(step);
    expect(result.pickup_in_seconds).toBe(pickup);
    expect(result.arrival_in_seconds).toBe(Math.max(0, 900 - minutes * 60));
    expect(result.simulated).toBe(true);
  },
);

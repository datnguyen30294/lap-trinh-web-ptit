import { describe, expect, it } from 'vitest';
import {
  distanceMeters,
  endOfVietnamDay,
  nextPickup,
  walkingMinutes,
} from './journey-calculation.js';

const now = Date.parse('2030-01-01T01:00:00Z');
const schedule = (
  id: string,
  departure: string,
  arrival = '2030-01-01T02:00:00Z',
) => ({
  id,
  route_id: '1',
  departure_at: departure,
  arrival_at: arrival,
});

describe('Journey estimates', () => {
  it('measures straight line meters and rounds walking time up', () => {
    expect(distanceMeters(21, 105, 21, 105)).toBe(0);
    expect(distanceMeters(0, 0, 0, 1)).toBeCloseTo(111194.9, 0);
    expect(
      distanceMeters(21.02655, 105.84968, 21.02755, 105.84968),
    ).toBeCloseTo(111.2, 0);
    expect(walkingMinutes(200)).toBe(3);
    expect(walkingMinutes(0)).toBe(0);
    expect(walkingMinutes(2000)).toBe(24);
  });

  it('skips a bus missed while walking and computes wait after arrival at the stop', () => {
    const result = nextPickup(
      [
        schedule('missed', '2030-01-01T00:58:00Z'), // pickup 01:03, walker arrives 01:04
        schedule('catchable', '2030-01-01T01:02:00Z'), // pickup 01:07
      ],
      now,
      4,
      5,
      20,
    );
    expect(result).toEqual({
      schedule_id: 'catchable',
      pickup_at: '2030-01-01T01:07:00.000Z',
      dropoff_at: '2030-01-01T01:22:00.000Z',
      wait_minutes: 3,
    });
  });

  it('includes a bus already departed from the origin but not yet at the boarding stop', () => {
    expect(
      nextPickup([schedule('enroute', '2030-01-01T00:55:00Z')], now, 5, 10, 20)
        ?.wait_minutes,
    ).toBe(0);
  });

  it('does not invent a wait without schedules or with an inconsistent arrival time', () => {
    expect(nextPickup([], now, 2, 5, 20)).toBeNull();
    expect(
      nextPickup(
        [schedule('bad', '2030-01-01T01:00:00Z', '2030-01-01T01:10:00Z')],
        now,
        2,
        5,
        20,
      ),
    ).toBeNull();
  });

  it('uses the Vietnam midnight boundary and excludes tomorrow pickups', () => {
    const nearMidnight = Date.parse('2030-01-01T16:58:00Z');
    expect(new Date(endOfVietnamDay(nearMidnight)).toISOString()).toBe(
      '2030-01-01T17:00:00.000Z',
    );
    expect(
      nextPickup(
        [schedule('tomorrow', '2030-01-01T16:55:00Z', '2030-01-01T18:00:00Z')],
        nearMidnight,
        1,
        5,
        20,
      ),
    ).toBeNull();
  });
});

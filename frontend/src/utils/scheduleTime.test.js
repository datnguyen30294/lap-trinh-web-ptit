import { expect, it } from 'vitest';
import { arrivalAt, displayTime, toLocalInput, toUtc } from './scheduleTime';
it('round-trips Vietnam midnight as the previous UTC date', () => {
  expect(toUtc('2099-01-01T00:00')).toBe('2098-12-31T17:00:00.000Z');
  expect(toLocalInput('2098-12-31T17:00:00Z')).toBe('2099-01-01T00:00:00');
  expect(displayTime('2098-12-31T17:00:00Z')).toContain('01/01/2099');
});
it('does not invent arrival when minutes or input are missing', () => {
  expect(arrivalAt('2099-01-01T08:00', null)).toBeNull();
  expect(arrivalAt('', 20)).toBeNull();
  expect(arrivalAt('2099-01-01T08:00', 20)).toBe('2099-01-01T01:20:00.000Z');
});

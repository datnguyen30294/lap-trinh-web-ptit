export const WALKING_SPEED_KMH = 5;
export const MAX_WALKING_DISTANCE_M = 2000;
const MINUTE_MS = 60000;

export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function walkingMinutes(meters: number) {
  return Math.ceil(meters / ((WALKING_SPEED_KMH * 1000) / 60));
}

export function endOfVietnamDay(now: number) {
  const dayMs = 86400000;
  const offset = 7 * 3600000;
  return (Math.floor((now + offset) / dayMs) + 1) * dayMs - offset;
}

export type JourneySchedule = {
  id: string;
  route_id: string;
  departure_at: string;
  arrival_at: string;
};

export function nextPickup(
  schedules: JourneySchedule[],
  now: number,
  walkMinutes: number,
  boardingOffset: number,
  destinationOffset: number,
) {
  const atStation = now + walkMinutes * MINUTE_MS;
  const end = endOfVietnamDay(now);
  // Rows are ordered by departure_at, so this is the earliest catchable bus.
  for (const schedule of schedules) {
    const departure = Date.parse(schedule.departure_at);
    const pickup = departure + boardingOffset * MINUTE_MS;
    const dropoff = departure + destinationOffset * MINUTE_MS;
    if (
      pickup < atStation ||
      pickup >= end ||
      dropoff > Date.parse(schedule.arrival_at)
    )
      continue;
    return {
      schedule_id: schedule.id,
      pickup_at: new Date(pickup).toISOString(),
      dropoff_at: new Date(dropoff).toISOString(),
      wait_minutes: Math.ceil((pickup - atStation) / MINUTE_MS),
    };
  }
  return null;
}

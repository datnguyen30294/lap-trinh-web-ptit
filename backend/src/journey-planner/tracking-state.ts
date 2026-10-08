import type { JourneysService } from './journeys.service.js';

export type ActiveJourney = {
  id: string;
  started_at: string;
  origin: { latitude: number; longitude: number; label?: string };
  journey: Awaited<ReturnType<JourneysService['detail']>>;
};

export function trackingState(active: ActiveJourney, now = Date.now()) {
  const journey = active.journey;
  const pickup = Date.parse(journey.pickup_at);
  const dropoff = Date.parse(journey.dropoff_at);
  const reachedStop =
    Date.parse(active.started_at) + journey.walking_minutes * 60000;
  const step =
    now >= dropoff ? 4 : now >= pickup ? 3 : now >= reachedStop ? 2 : 1;
  return {
    ...active,
    step,
    simulated: true,
    server_time: new Date(now).toISOString(),
    pickup_in_seconds: Math.max(0, Math.ceil((pickup - now) / 1000)),
    arrival_in_seconds: Math.max(0, Math.ceil((dropoff - now) / 1000)),
    arrival_at: journey.dropoff_at,
  };
}

declare module 'express-session' {
  interface SessionData {
    activeJourney?: ActiveJourney;
  }
}

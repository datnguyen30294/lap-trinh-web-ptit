import { useEffect, useState } from 'react';
import { passengerApi } from '../../services/passengerApi';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';

// Resolve URL IDs against the live catalog. Coordinates and labels come from
// the existing place API, never from guessed locations or the URL itself.
async function resolveStation(id, stations, signal) {
  if (!id) return null;
  const station = stations.find((item) => item.id === id);
  if (!station)
    throw new Error('Bến đã chọn không còn khả dụng. Hãy chọn lại bến.');
  const { items } = await journeyPlannerApi.places(station.code, signal);
  const place = items.find((item) => item.id === id);
  if (
    !place ||
    !Number.isFinite(place.latitude) ||
    !Number.isFinite(place.longitude)
  )
    throw new Error(
      `Chưa có tọa độ cho ${station.name}. Hãy chọn lại địa điểm trên bản đồ.`,
    );
  return place;
}

export function useJourneyPrefill(
  from,
  to,
  selectOrigin,
  selectDestination,
  search,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: !!(from || to), error: '' });

  useEffect(() => {
    if (!from && !to) return;
    const controller = new AbortController();
    async function load() {
      const stations = await passengerApi.stations(controller.signal);
      if (controller.signal.aborted) return;
      const results = await Promise.allSettled([
        resolveStation(from, stations, controller.signal),
        resolveStation(to, stations, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      const [origin, destination] = results.map((result) =>
        result.status === 'fulfilled' ? result.value : null,
      );
      const errors = results.flatMap((result) =>
        result.status === 'rejected' ? [result.reason.message] : [],
      );
      if (origin) selectOrigin({ ...origin, label: origin.name });
      if (destination) selectDestination(destination);
      if (from && from === to)
        errors.push('Điểm xuất phát và điểm đến phải khác nhau.');
      setState({ loading: false, error: [...new Set(errors)].join(' ') });
      if (origin && destination && !errors.length)
        search({ ...origin, label: origin.name }, destination);
    }
    load().catch((error) => {
      if (!controller.signal.aborted)
        setState({ loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [from, to, attempt, selectOrigin, selectDestination, search]);

  return {
    ...state,
    retry: () => {
      setState({ loading: true, error: '' });
      setAttempt((value) => value + 1);
    },
    dismiss: () => setState({ loading: false, error: '' }),
  };
}

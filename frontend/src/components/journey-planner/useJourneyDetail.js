import { useEffect, useState } from 'react';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';

export function useJourneyDetail(
  position,
  destinationId,
  routeId,
  selectionVersion,
) {
  const latitude = position?.latitude;
  const longitude = position?.longitude;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(null);
  const key =
    routeId && destinationId && latitude != null && longitude != null
      ? `${routeId}/${destinationId}/${latitude}/${longitude}/${selectionVersion}/${attempt}`
      : null;
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    journeyPlannerApi
      .detail(
        { latitude, longitude },
        destinationId,
        routeId,
        controller.signal,
      )
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key, status: 'success', data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, status: 'error', error: error.message });
      });
    return () => controller.abort();
  }, [key, latitude, longitude, destinationId, routeId]);
  return {
    ...(key
      ? state?.key === key
        ? state
        : { status: 'loading' }
      : { status: 'idle' }),
    retry: () => setAttempt((value) => value + 1),
  };
}

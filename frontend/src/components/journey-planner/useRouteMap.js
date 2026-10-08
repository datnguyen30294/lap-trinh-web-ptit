import { useEffect, useRef, useState } from 'react';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';

const EMPTY = [];
const segmentKey = (journey, toId) =>
  journey && toId
    ? `${journey.route_id}/${journey.boarding_station.id}/${toId}`
    : null;

export function useRouteMap(journey, destination, alternatives = EMPTY) {
  const toId = destination?.id;
  const selectedKey = segmentKey(journey, toId);
  // A new search owns a new cache. Geometry never survives a new search or login.
  const [state, setState] = useState({ group: null, entries: new Map() });
  const cache = useRef({ group: null, entries: new Map() });
  const [attempt, setAttempt] = useState(0);
  const targets = JSON.stringify([
    ...new Set(
      [
        selectedKey,
        ...alternatives.slice(0, 6).map((item) => segmentKey(item, toId)),
      ].filter(Boolean),
    ),
  ]);

  useEffect(() => {
    if (cache.current.group !== alternatives)
      cache.current = { group: alternatives, entries: new Map() };
    const controller = new AbortController();
    const queue = JSON.parse(targets);
    async function worker() {
      while (queue.length && !controller.signal.aborted) {
        const key = queue.shift();
        if (cache.current.entries.has(key)) continue;
        const [routeId, fromId, destinationId] = key.split('/');
        let result;
        try {
          const data = await journeyPlannerApi.routeMap(
            routeId,
            fromId,
            destinationId,
            controller.signal,
          );
          result = { status: 'success', data };
        } catch (error) {
          result = { status: 'error', error: error.message };
        }
        if (controller.signal.aborted) return;
        cache.current.entries.set(key, result);
        if (cache.current.entries.size > 24)
          cache.current.entries.delete(
            cache.current.entries.keys().next().value,
          );
        setState({
          group: alternatives,
          entries: new Map(cache.current.entries),
        });
      }
    }
    // Warm only likely choices, with bounded concurrency. Tile loading stays with Leaflet.
    void worker();
    void worker();
    return () => controller.abort();
  }, [targets, alternatives, attempt]);

  const entry =
    state.group === alternatives ? state.entries.get(selectedKey) : null;
  return {
    ...(selectedKey ? entry || { status: 'loading' } : { status: 'idle' }),
    retry: () => {
      cache.current.entries.delete(selectedKey);
      setState((previous) => {
        const entries = new Map(previous.entries);
        entries.delete(selectedKey);
        return { ...previous, entries };
      });
      setAttempt((value) => value + 1);
    },
  };
}

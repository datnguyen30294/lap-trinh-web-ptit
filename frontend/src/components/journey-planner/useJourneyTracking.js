import { useEffect, useRef, useState } from 'react';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';

export function useJourneyTracking() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('tracking');
  const [busy, setBusy] = useState('restore');
  const [error, setError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const mounted = useRef(false);
  const action = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    journeyPlannerApi
      .tracking(controller.signal)
      .then(({ active }) => {
        if (!controller.signal.aborted) setData(active);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy('');
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);

  const id = data?.id;
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let timer;
    async function refresh() {
      const version = revision.current;
      try {
        const { active } = await journeyPlannerApi.tracking(controller.signal);
        if (
          !controller.signal.aborted &&
          revision.current === version &&
          !action.current
        ) {
          setData((previous) =>
            active && previous?.id === active.id
              ? {
                  ...active,
                  origin: previous.origin,
                  journey: previous.journey,
                }
              : active,
          );
          setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted && revision.current === version)
          setError(err.message);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 15000);
      }
    }
    timer = setTimeout(refresh, 15000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id]);

  async function start(position, destinationId, routeId) {
    if (action.current || busy === 'restore') return;
    if (data) {
      setView('tracking');
      return;
    }
    action.current = true;
    revision.current++;
    setBusy('start');
    setError('');
    try {
      const result = await journeyPlannerApi.startTracking(
        position,
        destinationId,
        routeId,
      );
      if (mounted.current) {
        setData(result.active);
        setView('tracking');
      }
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      action.current = false;
      if (mounted.current) setBusy('');
    }
  }

  async function end() {
    if (action.current || !data) return null;
    action.current = true;
    revision.current++;
    const previous = data;
    setBusy('end');
    setError('');
    try {
      await journeyPlannerApi.endTracking(data.id);
      if (!mounted.current) return null;
      setData(null);
      setConfirmEnd(false);
      setView('tracking');
      return previous;
    } catch (err) {
      if (mounted.current) setError(err.message);
      return null;
    } finally {
      action.current = false;
      if (mounted.current) setBusy('');
    }
  }
  return {
    data,
    view,
    busy,
    error,
    start,
    end,
    confirmEnd,
    setConfirmEnd,
    setView,
  };
}

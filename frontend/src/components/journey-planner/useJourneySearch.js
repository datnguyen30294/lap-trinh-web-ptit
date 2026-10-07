import { useEffect, useRef, useState } from 'react';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';

const initial = {
  status: 'idle',
  result: null,
  error: '',
  selectedId: null,
  detailOpen: false,
};

export function useJourneySearch() {
  const [state, setState] = useState(initial);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);

  function reset() {
    pending.current?.abort();
    pending.current = null;
    setState(initial);
  }

  async function search(position, destination, preferredRouteId = null) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setState({ ...initial, status: 'loading' });
    try {
      const result = await journeyPlannerApi.search(
        position,
        destination.id,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setState({
        ...initial,
        status: 'success',
        result,
        error: '',
        selectedId: result.items.some(
          (item) => item.route_id === preferredRouteId,
        )
          ? preferredRouteId
          : null,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        ...initial,
        status: 'error',
        error: error.message || 'Không tìm được lộ trình. Vui lòng thử lại.',
      });
    }
  }

  return {
    ...state,
    selectionVersion,
    search,
    reset,
    select: (selectedId) => {
      setSelectionVersion((value) => value + 1);
      setState((current) => ({ ...current, selectedId, detailOpen: true }));
    },
    closeDetail: () =>
      setState((current) => ({ ...current, detailOpen: false })),
  };
}

import { useEffect, useState } from 'react';
import StationDialog from './stations/StationDialog';
import { passengerApi } from '../services/passengerApi';

export default function PassengerRouteResults({ criteria, onClose }) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    passengerApi
      .routes({ ...criteria, page, limit: 5 }, controller.signal)
      .then((data) => setState({ loading: false, data, error: '' }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [criteria, page, attempt]);
  function changePage(next) {
    setState({ loading: true, data: null, error: '' });
    setPage(next);
  }
  return (
    <StationDialog
      title="Tuyến xe đang hoạt động"
      onClose={onClose}
      className="passenger-dialog"
    >
      <p className="dialog-description">
        Tra cứu tuyến đi thẳng theo thứ tự điểm dừng. Giờ hoạt động theo giờ
        Việt Nam; chưa bao gồm lịch chuyến, bản đồ hoặc đặt vé.
      </p>
      {state.loading && <p role="status">Đang tìm tuyến xe…</p>}
      {state.error && (
        <div className="alert alert-error" role="alert">
          {state.error}
          <button
            className="button"
            onClick={() => {
              setState({ loading: true, data: null, error: '' });
              setAttempt(attempt + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      )}
      {state.data && (
        <>
          <p role="status">
            {state.data.total
              ? `Tìm thấy ${state.data.total} tuyến xe.`
              : 'Không tìm thấy tuyến đi thẳng phù hợp. Hãy thử điểm đi hoặc điểm đến khác.'}
          </p>
          <div className="passenger-results">
            {state.data.items.map((route) => (
              <article key={route.id}>
                <span className="home-pill">Tuyến {route.code}</span>
                <h3>{route.name}</h3>
                <p>
                  {route.origin_name} → {route.destination_name}
                </p>
                <p className="passenger-route-hours">
                  Giờ hoạt động: {route.operating_start.slice(0, 5)}–
                  {route.operating_end.slice(0, 5)} · Toàn tuyến:{' '}
                  {route.distance_km.toLocaleString('vi-VN')} km
                </p>
                <ol>
                  {route.stops.map((stop) => (
                    <li
                      key={stop.station_id}
                      className={
                        [
                          criteria.from_station_id,
                          criteria.to_station_id,
                        ].includes(stop.station_id)
                          ? 'selected-stop'
                          : ''
                      }
                    >
                      {stop.station_name}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
          {state.data.totalPages > 1 && (
            <nav
              className="passenger-result-pages"
              aria-label="Trang kết quả tuyến xe"
            >
              <button
                className="button"
                disabled={page === 1}
                onClick={() => changePage(page - 1)}
              >
                Trước
              </button>
              <span>
                Trang {page}/{state.data.totalPages}
              </span>
              <button
                className="button"
                disabled={page >= state.data.totalPages}
                onClick={() => changePage(page + 1)}
              >
                Sau
              </button>
            </nav>
          )}
        </>
      )}
    </StationDialog>
  );
}

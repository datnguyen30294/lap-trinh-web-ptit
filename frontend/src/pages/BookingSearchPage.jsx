import AppLink from '../components/AppLink';
import { useEffect, useState } from 'react';
import { passengerApi } from '../services/passengerApi';
import { bookingsApi } from '../services/bookingsApi';
import BookingResults from '../components/bookings/BookingResults';
import {
  money,
  searchParams,
  tripBookingLink,
  tripDateTime,
  vietnamToday,
} from '../utils/bookingFormat';

export default function BookingSearchPage() {
  const [form, setForm] = useState(() => {
    const params = searchParams();
    return {
      from_station_id: params.from || '',
      to_station_id: params.to || '',
      date: vietnamToday(),
      route_id: params.route || '',
    };
  });
  const [stations, setStations] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [criteria, setCriteria] = useState(null);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: false, data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    passengerApi
      .stations(controller.signal)
      .then(setStations)
      .catch((error) => {
        if (!controller.signal.aborted) setCatalogError(error.message);
      });
    return () => controller.abort();
  }, [catalogAttempt]);
  useEffect(() => {
    if (!criteria) return;
    const controller = new AbortController();
    bookingsApi
      .trips({ ...criteria, page, limit: 6 }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ loading: false, data, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [criteria, page, attempt]);
  function search(event) {
    event.preventDefault();
    if (form.from_station_id === form.to_station_id) {
      setState({
        loading: false,
        data: null,
        error: 'Điểm đi và điểm đến phải khác nhau.',
      });
      return;
    }
    setPage(1);
    setCriteria({ ...form });
    setState((previous) => ({ ...previous, loading: true, error: '' }));
  }
  function changePage(next) {
    setPage(next);
    setState((previous) => ({ ...previous, loading: true, error: '' }));
  }
  return (
    <>
      <div className="booking-title-row">
        <div className="booking-heading">
          <h1>Đặt vé trực tuyến</h1>
          <p>Chọn chặng và ngày đi để tìm chuyến xe phù hợp với bạn.</p>
        </div>
        <AppLink className="booking-button outline" href="/user/tickets">
          Vé của tôi
        </AppLink>
      </div>
      <form className="booking-card booking-search-form" onSubmit={search}>
        {[
          ['from_station_id', 'Điểm đi'],
          ['to_station_id', 'Điểm đến'],
        ].map(([field, label]) => (
          <label className="booking-field" key={field}>
            <span>{label} *</span>
            <select
              required
              value={form[field]}
              onChange={(event) =>
                setForm({ ...form, [field]: event.target.value, route_id: '' })
              }
              disabled={!stations.length}
            >
              <option value="">Chọn {label.toLowerCase()}</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="booking-field">
          <span>Ngày đi *</span>
          <input
            required
            type="date"
            min={vietnamToday()}
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </label>
        <button
          className="booking-button"
          disabled={!stations.length || state.loading}
        >
          Tìm chuyến xe
        </button>
        {catalogError && (
          <div className="booking-error" role="alert">
            {catalogError}{' '}
            <button
              type="button"
              className="booking-button outline"
              onClick={() => {
                setCatalogError('');
                setCatalogAttempt(catalogAttempt + 1);
              }}
            >
              Thử tải lại bến
            </button>
          </div>
        )}
      </form>
      <BookingResults
        state={state}
        onRetry={
          criteria
            ? () => {
                setState((previous) => ({
                  ...previous,
                  loading: true,
                  error: '',
                }));
                setAttempt(attempt + 1);
              }
            : undefined
        }
      >
        {!criteria && !state.error && (
          <div className="booking-empty">
            <h2>Bắt đầu hành trình của bạn</h2>
            <p>
              Chọn điểm đi, điểm đến và ngày đi ở phía trên để xem giờ chạy và
              chỗ trống.
            </p>
          </div>
        )}
        {state.data && (
          <>
            <p className="booking-muted" role="status">
              {state.data.total
                ? `Tìm thấy ${state.data.total} chuyến xe.`
                : 'Không có chuyến phù hợp trong ngày này. Bạn có thể chọn ngày hoặc chặng khác.'}
            </p>
            <div className="booking-trip-list">
              {state.data.items.map((trip) => (
                <article
                  className="booking-card booking-trip-result"
                  key={trip.id}
                >
                  <div>
                    <span className="booking-status confirmed">
                      Tuyến {trip.route_code}
                    </span>
                    <h2>
                      {trip.from_station} → {trip.to_station}
                    </h2>
                    <p className="booking-muted">
                      {tripDateTime(trip.pickup_at)} · Xe {trip.vehicle_code}
                    </p>
                    <p className="booking-muted">
                      Ghế ngồi {trip.capacity} chỗ · Còn {trip.remaining} chỗ
                      trên chặng
                    </p>
                  </div>
                  <div className="booking-trip-action">
                    <strong className="booking-price">
                      {money(trip.unit_price)}
                    </strong>
                    {trip.remaining ? (
                      <AppLink
                        className="booking-button"
                        href={tripBookingLink(trip)}
                      >
                        Đặt vé
                      </AppLink>
                    ) : (
                      <span className="booking-status cancelled">Hết chỗ</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {state.data.totalPages > 1 && (
              <nav className="booking-pagination" aria-label="Trang chuyến xe">
                <button
                  className="booking-button outline"
                  disabled={page === 1}
                  onClick={() => changePage(page - 1)}
                >
                  Trước
                </button>
                <span>
                  Trang {page}/{state.data.totalPages}
                </span>
                <button
                  className="booking-button outline"
                  disabled={page === state.data.totalPages}
                  onClick={() => changePage(page + 1)}
                >
                  Sau
                </button>
              </nav>
            )}
          </>
        )}
      </BookingResults>
    </>
  );
}

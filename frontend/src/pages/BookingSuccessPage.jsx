import AppLink from '../components/AppLink';
import { useEffect, useState } from 'react';
import { bookingsApi } from '../services/bookingsApi';
import BookingState from '../components/bookings/BookingState';
import TicketStatus from '../components/bookings/TicketStatus';
import { money, searchParams, tripDateTime } from '../utils/bookingFormat';

export default function BookingSuccessPage() {
  const [requestId] = useState(() => searchParams().request || '');
  const [state, setState] = useState({ loading: true, tickets: [], error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!requestId) return;
    bookingsApi
      .receipt(requestId, controller.signal)
      .then((tickets) => setState({ loading: false, tickets, error: '' }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, tickets: [], error: error.message });
      });
    return () => controller.abort();
  }, [requestId, attempt]);
  const first = state.tickets[0];
  return (
    <div className="booking-success">
      <BookingState
        loading={!!requestId && state.loading}
        error={
          !requestId
            ? 'Không tìm thấy lần đặt vé. Hãy mở Vé của tôi để kiểm tra.'
            : state.error
        }
        onRetry={() => {
          setState({ loading: true, tickets: [], error: '' });
          setAttempt(attempt + 1);
        }}
      />
      {first && (
        <>
          <div className="booking-success-icon" aria-hidden="true">
            ✓
          </div>
          <div className="booking-heading">
            <h1>Đặt vé thành công!</h1>
            <p>
              Vé điện tử đã được lưu trong Vé của tôi. Vui lòng có mặt tại bến
              đón trước giờ khởi hành 15 phút.
            </p>
          </div>
          <section className="booking-card booking-success-card">
            <div className="booking-card-title">
              <div>
                <p className="booking-muted booking-small">Mã vé</p>
                <strong>{first.booking_code}</strong>
              </div>
              <TicketStatus status={first.display_status} />
            </div>
            <hr />
            <dl className="booking-details">
              <div>
                <dt>Tuyến</dt>
                <dd>
                  {first.from_station} → {first.to_station}
                </dd>
              </div>
              <div>
                <dt>Ngày đi</dt>
                <dd>{tripDateTime(first.pickup_at)}</dd>
              </div>
              <div>
                <dt>Bến đón</dt>
                <dd>{first.from_station}</dd>
              </div>
              <div>
                <dt>Hành khách</dt>
                <dd>
                  {state.tickets
                    .map((ticket) => ticket.passenger_name)
                    .join(', ')}
                </dd>
              </div>
              <div>
                <dt>Số lượng vé</dt>
                <dd>{String(state.tickets.length).padStart(2, '0')} vé</dd>
              </div>
            </dl>
            {state.tickets.length > 1 && (
              <ul className="booking-created-tickets">
                {state.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <AppLink href={`/user/tickets/${ticket.id}`}>
                      {ticket.passenger_name} · {ticket.booking_code}
                    </AppLink>
                  </li>
                ))}
              </ul>
            )}
            <hr />
            <div className="booking-total">
              <strong>Tổng tiền đặt vé</strong>
              <strong>
                {money(
                  state.tickets.reduce(
                    (sum, ticket) => sum + ticket.unit_price,
                    0,
                  ),
                )}
              </strong>
            </div>
          </section>
          <div className="booking-actions">
            <AppLink className="booking-button" href="/user/tickets">
              Xem vé của tôi
            </AppLink>
            <AppLink className="booking-button outline" href="/user/home">
              Về trang chủ
            </AppLink>
          </div>
        </>
      )}
    </div>
  );
}

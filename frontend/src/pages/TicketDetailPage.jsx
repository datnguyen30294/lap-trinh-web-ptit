import AppLink from '../components/AppLink';
import { useEffect, useState } from 'react';
import { bookingsApi } from '../services/bookingsApi';
import BookingState from '../components/bookings/BookingState';
import TicketStatus from '../components/bookings/TicketStatus';
import CancelTicketDialog from '../components/bookings/CancelTicketDialog';
import { money, tripDateTime } from '../utils/bookingFormat';

export default function TicketDetailPage({ id }) {
  const [state, setState] = useState({
    loading: true,
    ticket: null,
    error: '',
  });
  const [attempt, setAttempt] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    bookingsApi
      .detail(id, controller.signal)
      .then((ticket) => setState({ loading: false, ticket, error: '' }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, ticket: null, error: error.message });
      });
    return () => controller.abort();
  }, [id, attempt]);
  const ticket = state.ticket;
  return (
    <>
      <AppLink className="booking-back" href="/user/tickets">
        ←&nbsp; Quay lại Vé của tôi
      </AppLink>
      <div className="booking-heading">
        <h1>Chi tiết vé</h1>
        <p>
          {ticket
            ? `Mã vé ${ticket.booking_code}`
            : 'Thông tin vé điện tử của bạn.'}
        </p>
      </div>
      <BookingState
        loading={state.loading}
        error={state.error}
        onRetry={() => {
          setState({ loading: true, ticket: null, error: '' });
          setAttempt(attempt + 1);
        }}
      />
      {ticket && (
        <div className="booking-columns">
          <div className="booking-left">
            <section className="booking-card booking-ticket-detail">
              <div className="booking-card-title">
                <h2>
                  {ticket.from_station} → {ticket.to_station}
                </h2>
                <TicketStatus status={ticket.display_status} />
              </div>
              <hr />
              <dl className="booking-details">
                {[
                  ['Ngày đi', tripDateTime(ticket.pickup_at)],
                  ['Bến đón', ticket.from_station],
                  ['Loại xe', `Ghế ngồi ${ticket.capacity} chỗ`],
                  ['Hành khách', ticket.passenger_name],
                  ['Số điện thoại', ticket.contact_phone],
                  ['Email', ticket.email],
                  ['Số lượng vé', '01 vé'],
                  ['Đơn giá', money(ticket.unit_price)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <hr />
              <div className="booking-total">
                <strong>Tổng tiền</strong>
                <strong>{money(ticket.unit_price)}</strong>
              </div>
            </section>
            {ticket.status === 'CANCELLED' && (
              <p className="booking-message cancelled" role="status">
                Vé đã được hủy lúc {tripDateTime(ticket.cancelled_at)}. Số chỗ
                đã được hoàn lại.
              </p>
            )}
            <div className="booking-actions">
              {ticket.can_cancel && (
                <button
                  className="booking-button danger-soft"
                  onClick={() => setCancelOpen(true)}
                >
                  Hủy vé này
                </button>
              )}
              <AppLink className="booking-button outline" href="/user/tickets">
                Quay lại danh sách vé
              </AppLink>
            </div>
          </div>
          <aside className="booking-card booking-qr-card">
            <h2>Vé điện tử, quét mã khi lên xe</h2>
            <img
              src={ticket.qr_data_url}
              alt={`Mã QR vé ${ticket.booking_code}`}
              width="200"
              height="200"
            />
            <p>{ticket.booking_code}</p>
            {ticket.status === 'CANCELLED' && (
              <small>Vé đã hủy không còn hiệu lực.</small>
            )}
          </aside>
        </div>
      )}
      {cancelOpen && (
        <CancelTicketDialog
          ticket={ticket}
          onClose={() => setCancelOpen(false)}
          onCancelled={(updated) => {
            setCancelOpen(false);
            setState({
              loading: false,
              ticket: { ...ticket, ...updated },
              error: '',
            });
          }}
        />
      )}
    </>
  );
}

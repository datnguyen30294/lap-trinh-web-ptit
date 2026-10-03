import AppLink from '../components/AppLink';
import { useEffect, useState } from 'react';
import { bookingsApi } from '../services/bookingsApi';
import BookingResults from '../components/bookings/BookingResults';
import TicketStatus from '../components/bookings/TicketStatus';
import CancelTicketDialog from '../components/bookings/CancelTicketDialog';
import { money, tripDateTime } from '../utils/bookingFormat';

const filters = [
  ['ALL', 'Tất cả'],
  ['CONFIRMED', 'Đã đặt'],
  ['COMPLETED', 'Hoàn thành'],
  ['CANCELLED', 'Đã hủy'],
];
export default function MyTicketsPage() {
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [cancelTicket, setCancelTicket] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    bookingsApi
      .list({ filter, page, limit: 10 }, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ loading: false, data, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [filter, page, attempt]);
  function refresh() {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    setAttempt(attempt + 1);
  }
  function cancelled(ticket) {
    setCancelTicket(null);
    setNotice(
      `Đã hủy vé ${ticket.booking_code} thành công. Số chỗ đã được hoàn lại.`,
    );
    setPage(1);
    refresh();
  }
  return (
    <>
      {notice && (
        <p className="booking-message success" role="status">
          {notice}
        </p>
      )}
      <div className="booking-heading">
        <h1>Vé của tôi</h1>
        <p>Danh sách vé bạn đã đặt trên GoBus.</p>
      </div>
      <div className="booking-filters" aria-label="Lọc trạng thái vé">
        {filters.map(([value, label]) => (
          <button
            key={value}
            className={`booking-button ${filter === value ? '' : 'outline'}`}
            aria-pressed={filter === value}
            onClick={() => {
              if (filter === value) return;
              setFilter(value);
              setPage(1);
              setState((previous) => ({
                ...previous,
                loading: true,
                error: '',
              }));
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <BookingResults state={state} onRetry={refresh}>
        {state.data && (
          <>
            {!state.data.items.length && (
              <div className="booking-card booking-empty">
                <h2>Chưa có vé trong danh sách này</h2>
                <p>
                  Vé bạn đặt sẽ xuất hiện tại đây để xem lại hoặc hủy trước giờ
                  đón.
                </p>
                <AppLink className="booking-button" href="/user/bookings">
                  Đặt vé ngay
                </AppLink>
              </div>
            )}
            <div className="booking-ticket-list">
              {state.data.items.map((ticket) => (
                <article
                  className="booking-card booking-ticket-card"
                  key={ticket.id}
                >
                  <div className="booking-ticket-copy">
                    <div className="booking-ticket-code">
                      <span>{ticket.booking_code}</span>
                      <TicketStatus status={ticket.display_status} />
                    </div>
                    <h2>
                      {ticket.from_station} → {ticket.to_station}
                    </h2>
                    <div className="booking-ticket-meta">
                      <span>{tripDateTime(ticket.pickup_at)}</span>
                      <span>{ticket.from_station}</span>
                      <span>01 vé · {ticket.passenger_name}</span>
                    </div>
                  </div>
                  <div className="booking-ticket-action">
                    <strong className="booking-price">
                      {money(ticket.unit_price)}
                    </strong>
                    <div className="booking-actions">
                      <AppLink
                        className="booking-button outline"
                        href={`/user/tickets/${ticket.id}`}
                      >
                        Xem chi tiết
                      </AppLink>
                      {ticket.can_cancel && (
                        <button
                          className="booking-button danger-soft"
                          onClick={() => setCancelTicket(ticket)}
                        >
                          Hủy vé
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {state.data.totalPages > 1 && (
              <nav className="booking-pagination" aria-label="Trang vé của tôi">
                <button
                  className="booking-button outline"
                  disabled={page === 1}
                  onClick={() => {
                    setPage(page - 1);
                    setState((previous) => ({
                      ...previous,
                      loading: true,
                      error: '',
                    }));
                  }}
                >
                  Trước
                </button>
                <span>
                  Trang {page}/{state.data.totalPages}
                </span>
                <button
                  className="booking-button outline"
                  disabled={page >= state.data.totalPages}
                  onClick={() => {
                    setPage(page + 1);
                    setState((previous) => ({
                      ...previous,
                      loading: true,
                      error: '',
                    }));
                  }}
                >
                  Sau
                </button>
              </nav>
            )}
          </>
        )}
      </BookingResults>
      {cancelTicket && (
        <CancelTicketDialog
          ticket={cancelTicket}
          onClose={() => setCancelTicket(null)}
          onCancelled={cancelled}
        />
      )}
    </>
  );
}

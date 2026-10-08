import AppLink from '../AppLink';
export default function BookingState({ loading, error, onRetry }) {
  if (loading)
    return (
      <div className="booking-card booking-state" role="status">
        Đang tải thông tin vé…
      </div>
    );
  if (!error) return null;
  return (
    <div className="booking-card booking-state">
      <p className="booking-error" role="alert">
        {error}
      </p>
      {onRetry && (
        <button className="booking-button" onClick={onRetry}>
          Thử lại
        </button>
      )}
      <AppLink className="booking-button outline" href="/user/bookings">
        Chọn chuyến khác
      </AppLink>
    </div>
  );
}

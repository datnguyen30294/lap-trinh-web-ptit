import BookingState from './BookingState';

// Giữ danh sách cũ trong lúc tải, tránh trang co lại rồi bung ra.
export default function BookingResults({ state, onRetry, children }) {
  const refreshing = state.loading && !!state.data;
  return (
    <section className="booking-results" aria-busy={state.loading}>
      <BookingState
        loading={state.loading && !state.data}
        error={state.error}
        onRetry={onRetry}
      />
      {refreshing && (
        <p className="booking-refresh" role="status">
          Đang cập nhật danh sách…
        </p>
      )}
      <div className="booking-result-content" inert={refreshing}>
        {children}
      </div>
    </section>
  );
}

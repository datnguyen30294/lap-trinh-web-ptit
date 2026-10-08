import StationDialog from '../stations/StationDialog';
import './journey-tracking.css';

export default function EndJourneyDialog({ tracking, onEnd }) {
  const journey = tracking.data.journey;
  const busy = tracking.busy === 'end';
  return (
    <StationDialog
      title="Kết thúc theo dõi hành trình?"
      className="jp-end-dialog"
      busy={busy}
      onClose={() => tracking.setConfirmEnd(false)}
    >
      <p>GoBus sẽ dừng theo dõi và nhắc điểm xuống của chuyến này.</p>
      <div className="jp-end-summary">
        <span>Tuyến {journey.route_code}</span>
        <strong>
          {journey.boarding_station.name} → {journey.alighting_station.name}
        </strong>
        <small>
          Điểm đi và điểm đến được giữ lại để tìm các chuyến còn phù hợp.
        </small>
      </div>
      {tracking.error && (
        <p className="jp-error" role="alert">
          {tracking.error}
        </p>
      )}
      <div className="jp-detail-actions">
        <button
          type="button"
          className="jp-detail-start"
          disabled={busy}
          onClick={() => tracking.setConfirmEnd(false)}
        >
          Tiếp tục hành trình
        </button>
        <button
          type="button"
          className="jp-detail-buy"
          disabled={busy}
          onClick={onEnd}
        >
          {busy ? 'Đang kết thúc…' : 'Kết thúc'}
        </button>
      </div>
    </StationDialog>
  );
}

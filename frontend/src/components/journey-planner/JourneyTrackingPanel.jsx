import './journey-tracking.css';

const time = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
const steps = [
  'Đi đến điểm dừng',
  'Chờ xe tại bến',
  'Di chuyển trên xe',
  'Đến điểm đến',
];

export default function JourneyTrackingPanel({ tracking }) {
  const { data } = tracking;
  const journey = data.journey;
  const descriptions = [
    `Đi bộ khoảng ${journey.walking_distance_m} m đến ${journey.boarding_station.name}.`,
    `Chờ tuyến ${journey.route_code} tại ${journey.boarding_station.name}.`,
    `Dự kiến đang đi đến ${journey.alighting_station.name}, qua ${journey.stop_count} điểm dừng.`,
    `Đã tới giờ đến ${journey.alighting_station.name} theo lịch dự kiến.`,
  ];
  return (
    <aside
      className="jp-sidebar jp-tracking-panel"
      aria-label="Theo dõi hành trình"
    >
      <h1>Đang theo dõi hành trình</h1>
      <p className="jp-tracking-subtitle">
        Tuyến {journey.route_code} · {journey.alighting_station.name}
      </p>
      <div className="jp-tracking-step" role="status" aria-live="polite">
        <strong>
          Bước {data.step} / 4 · {steps[data.step - 1]}
        </strong>
        <p>{descriptions[data.step - 1]}</p>
      </div>
      <div className="jp-tracking-estimate">
        <p>
          {data.step < 3
            ? 'Xe của chuyến đã chọn dự kiến đến sau'
            : data.step === 3
              ? 'Dự kiến tới điểm xuống sau'
              : 'Đã tới giờ đến dự kiến'}
        </p>
        <strong className="jp-tracking-minutes">
          {Math.ceil(
            (data.step < 3 ? data.pickup_in_seconds : data.arrival_in_seconds) /
              60,
          )}{' '}
          phút
        </strong>
        <strong>
          Tuyến {journey.route_code} · Hướng {journey.alighting_station.name}
        </strong>
        <div className="jp-tracking-arrival">
          Dự kiến đến nơi · {time(data.arrival_at)}
        </div>
        <small>Mô phỏng theo lịch chuyến</small>
      </div>
      <p className="jp-tracking-dropoff">
        Điểm xuống: {journey.alighting_station.name}.
      </p>
      {tracking.error && (
        <p className="jp-error" role="alert">
          {tracking.error} Đang giữ thông tin cập nhật gần nhất.
        </p>
      )}
      <div className="jp-detail-actions">
        <button type="button" className="jp-detail-buy" aria-disabled="true">
          Mua vé
        </button>
        <button
          type="button"
          className="jp-detail-buy"
          onClick={() => tracking.setConfirmEnd(true)}
        >
          Kết thúc hành trình
        </button>
        <button
          type="button"
          className="jp-back-routes"
          onClick={() => tracking.setView('detail')}
        >
          Xem chi tiết hành trình
        </button>
      </div>
    </aside>
  );
}

import JourneyTimeline from './JourneyTimeline';
import JourneySearchSkeleton from './JourneySearchSkeleton';
import './journey-detail.css';

const money = new Intl.NumberFormat('vi-VN');

function journeySteps(journey) {
  const pickup = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(journey.pickup_at));
  return [
    {
      kind: 'walk',
      title: `Đi bộ đến ${journey.boarding_station.name}`,
      description: `Khoảng ${journey.walking_minutes} phút · ${journey.walking_distance_m} m (ước tính)`,
    },
    {
      kind: 'bus',
      title: `Lên xe buýt ${journey.route_code}`,
      description: `Chờ tại bến khoảng ${journey.wait_minutes} phút · Đón lúc ${pickup}`,
    },
    {
      kind: 'stop',
      title: `Xuống tại ${journey.alighting_station.name}`,
      description: `${journey.stop_count} điểm dừng · Đi xe ${journey.ride_minutes} phút`,
      address: journey.alighting_station.address,
    },
    {
      kind: 'walk',
      title: 'Đi bộ đến điểm đến',
      description:
        journey.walking_after_m === 0
          ? 'Điểm đến ngay tại bến · 0 m'
          : `Khoảng ${journey.walking_after_minutes} phút · ${journey.walking_after_m} m`,
    },
  ];
}

function DetailContent({ journey, onStart, tracking }) {
  const steps = journeySteps(journey);
  return (
    <>
      <div className="jp-detail-summary">
        <div>
          <strong>{journey.total_minutes} phút</strong>
          <span>{money.format(journey.fare_vnd)}đ / lượt</span>
        </div>
        <p>
          Đi bộ {journey.walking_distance_m + journey.walking_after_m} m · Không
          chuyển tuyến
        </p>
      </div>
      <JourneyTimeline steps={steps} />
      {tracking.error && (
        <p className="jp-error" role="alert">
          {tracking.error}
        </p>
      )}
      <div className="jp-detail-actions">
        <button
          type="button"
          className="jp-detail-start"
          disabled={!!tracking.busy}
          onClick={onStart}
        >
          {tracking.busy === 'start'
            ? 'Đang bắt đầu…'
            : tracking.data
              ? 'Tiếp tục hành trình'
              : 'Bắt đầu hành trình'}
        </button>
        <button type="button" className="jp-detail-buy" aria-disabled="true">
          Mua vé
        </button>
      </div>
    </>
  );
}

export default function JourneyDetailPanel({
  detail,
  routeCode,
  onBack,
  onStart,
  tracking,
  backLabel = 'Quay lại các tuyến',
}) {
  return (
    <aside
      className="jp-sidebar jp-detail-panel"
      aria-label="Chi tiết lộ trình"
    >
      <h1>Chi tiết tuyến {detail.data?.route_code || routeCode}</h1>
      {detail.status === 'success' && (
        <p className="jp-detail-direction">
          {detail.data.boarding_station.name} →{' '}
          {detail.data.alighting_station.name}
        </p>
      )}
      <button
        type="button"
        className="jp-back-routes"
        onClick={onBack}
        disabled={tracking.busy === 'start'}
      >
        ← {backLabel}
      </button>
      {detail.status === 'loading' && (
        <JourneySearchSkeleton label="Đang tải chi tiết tuyến" />
      )}
      {detail.status === 'error' && (
        <div className="jp-error" role="alert">
          <p>{detail.error}</p>
          <button
            className="jp-location-button"
            type="button"
            onClick={detail.retry}
          >
            Thử lại chi tiết
          </button>
        </div>
      )}
      {detail.status === 'success' && (
        <DetailContent
          key={`${detail.data.route_id}/${detail.data.schedule_id}`}
          journey={detail.data}
          onStart={onStart}
          tracking={tracking}
        />
      )}
    </aside>
  );
}

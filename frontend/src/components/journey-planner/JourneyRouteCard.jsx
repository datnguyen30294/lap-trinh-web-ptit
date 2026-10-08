const money = new Intl.NumberFormat('vi-VN');

function walkingDistance(meters) {
  return meters < 1000
    ? `${meters} m`
    : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export default function JourneyRouteCard({
  journey,
  fastest,
  selected,
  onSelect,
}) {
  return (
    <li>
      <button
        type="button"
        className={`jp-route-card${selected ? ' jp-route-selected' : ''}`}
        aria-pressed={selected}
        onClick={onSelect}
        title={`${journey.route_name}. Lên tại ${journey.boarding_station.name}`}
      >
        <span className="jp-route-top">
          <span className="jp-route-badge">Tuyến {journey.route_code}</span>
          {fastest && <span className="jp-fastest">Nhanh nhất</span>}
          <span className="jp-route-fare">
            {money.format(journey.fare_vnd)}đ
          </span>
        </span>
        <span className="jp-route-duration">
          <strong>{journey.total_minutes} phút</strong>
          <span> · Chờ {journey.wait_minutes} phút</span>
        </span>
        <span className="jp-route-walk">
          <svg
            width="14"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="14" cy="4" r="2" />
            <path d="m7 21 4-7m5 7-2-6-4-3 2-5 4 4h4M5 12l3-4 4-1" />
          </svg>
          Đi bộ {walkingDistance(journey.walking_distance_m)} · Không chuyển
          tuyến
        </span>
      </button>
    </li>
  );
}

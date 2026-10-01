import StationStatus from '../stations/StationStatus';
export default function RouteDetail({ route, onEdit, onBack }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Chi tiết tuyến {route.code}</h1>
          <p className="muted">{route.name}</p>
        </div>
        <div className="row-actions">
          <button className="button" onClick={onBack}>
            Quay lại
          </button>
          <button className="button button-primary" onClick={onEdit}>
            Sửa tuyến
          </button>
        </div>
      </div>
      <section className="route-card">
        <h2>Thông tin tuyến xe</h2>
        <dl className="route-facts">
          <div>
            <dt>Mã tuyến</dt>
            <dd>{route.code}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <StationStatus active={route.status === 'ACTIVE'} />
            </dd>
          </div>
          <div>
            <dt>Bến đầu</dt>
            <dd>{route.origin_name}</dd>
          </div>
          <div>
            <dt>Bến cuối</dt>
            <dd>{route.destination_name}</dd>
          </div>
          <div>
            <dt>Giờ hoạt động</dt>
            <dd>
              {route.operating_start} – {route.operating_end}
            </dd>
          </div>
          <div>
            <dt>Khoảng cách</dt>
            <dd>{route.distance_km} km</dd>
          </div>
          <div>
            <dt>Thời lượng</dt>
            <dd>
              {route.stops.at(-1)?.minutes_from_origin == null
                ? 'Chưa có dữ liệu'
                : `${route.stops.at(-1).minutes_from_origin} phút`}
            </dd>
          </div>
          <div>
            <dt>Lịch trình liên kết</dt>
            <dd>{route.schedule_count}</dd>
          </div>
        </dl>
        {route.has_bookings && (
          <p className="route-note">
            Tuyến đã có đơn đặt vé. Mã, tên và hành trình được bảo vệ để giữ
            nguyên lịch sử, kể cả đơn đã hủy.
          </p>
        )}
      </section>
      <section className="route-card">
        <h2>Hành trình · {route.stops.length} điểm dừng</h2>
        <p className="muted">
          Thời gian và khoảng cách tính từ bến đầu, theo một chiều.
        </p>
        <ol className="route-timeline">
          {route.stops.map((s, i) => (
            <li key={s.id}>
              <span className="stop-number">{s.stop_order}</span>
              <div>
                <strong>{s.station_name}</strong>
                <p className="muted">
                  {s.station_code} ·{' '}
                  {i === 0
                    ? 'Bến đầu'
                    : i === route.stops.length - 1
                      ? 'Bến cuối'
                      : 'Điểm dừng'}
                </p>
                <StationStatus active={Boolean(s.is_active)} />
              </div>
              <span className="stop-metrics">
                {s.minutes_from_origin === null
                  ? 'Chưa có số phút'
                  : `${s.minutes_from_origin} phút`}{' '}
                · {s.km_from_origin} km
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

import ScheduleStatus from './ScheduleStatus';
import { displayTime } from '../../utils/scheduleTime';
export default function ScheduleDetail({
  schedule: s,
  onBack,
  onEdit,
  onStatus,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Chi tiết lịch trình #{s.id}</h1>
          <p className="muted">
            {s.route_code} · {s.route_name}
          </p>
        </div>
        <div className="row-actions">
          <button className="button" onClick={onBack}>
            Quay lại danh sách
          </button>
          <button className="button" onClick={onEdit}>
            Xem biểu mẫu sửa
          </button>
          {['SCHEDULED', 'DEPARTED'].includes(s.status) && (
            <button className="button button-primary" onClick={onStatus}>
              Đổi trạng thái
            </button>
          )}
        </div>
      </div>
      <section className="route-card">
        <h2>Thông tin chuyến</h2>
        <dl className="route-facts">
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <ScheduleStatus status={s.status} />
            </dd>
          </div>
          <div>
            <dt>Xe / sức chứa</dt>
            <dd>
              {s.vehicle_code} / {s.capacity} chỗ
            </dd>
          </div>
          <div>
            <dt>Bến đầu</dt>
            <dd>{s.origin_name}</dd>
          </div>
          <div>
            <dt>Bến cuối</dt>
            <dd>{s.destination_name}</dd>
          </div>
          <div>
            <dt>Khởi hành (Việt Nam)</dt>
            <dd>{displayTime(s.departure_at)}</dd>
          </div>
          <div>
            <dt>Giờ đến (Việt Nam)</dt>
            <dd>{displayTime(s.arrival_at)}</dd>
          </div>
          <div>
            <dt>Vé đã xác nhận</dt>
            <dd>{s.confirmed_bookings}</dd>
          </div>
        </dl>
        <p className="muted">
          Tổng vé có thể trải trên các chặng khác nhau, không phải số ghế bị
          chiếm cùng lúc.
        </p>
        {!s.can_edit && <p className="route-note">{s.edit_block_reason}</p>}
      </section>
      <section className="route-card">
        <h2>Hành trình và giờ dự kiến</h2>
        <p className="muted">
          Asia/Ho_Chi_Minh (UTC+7). Phút/km tính từ bến đầu.
        </p>
        <ol className="route-timeline">
          {s.stops.map((stop) => (
            <li key={stop.id}>
              <span className="stop-number">{stop.stop_order}</span>
              <div>
                <strong>{stop.station_name}</strong>
                <p className="muted">
                  {stop.station_code} · {stop.km_from_origin} km
                </p>
              </div>
              <div className="stop-metrics">
                {stop.expected_at
                  ? displayTime(stop.expected_at)
                  : 'Chưa có số phút, chưa tính được giờ'}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

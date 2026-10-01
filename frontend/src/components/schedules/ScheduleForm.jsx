import { useEffect, useState } from 'react';
import StationDialog from '../stations/StationDialog';
import { routesApi } from '../../services/routesApi';
import {
  arrivalAt,
  displayTime,
  toLocalInput,
  toUtc,
} from '../../utils/scheduleTime';
export default function ScheduleForm({ schedule, options, onClose, onSave }) {
  const [values, setValues] = useState({
    route_id: schedule?.route_id ?? '',
    vehicle_id: schedule?.vehicle_id ?? '',
    departure: toLocalInput(schedule?.departure_at),
  });
  const [route, setRoute] = useState(null),
    [routeError, setRouteError] = useState(''),
    [loading, setLoading] = useState(!!schedule),
    [revision, setRevision] = useState(0);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const locked = !!schedule && !schedule.can_edit;
  useEffect(() => {
    if (!values.route_id) return;
    const controller = new AbortController();
    routesApi
      .detail(values.route_id, controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) {
          setRoute(r);
          setLoading(false);
          setRouteError('');
        }
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setRouteError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [values.route_id, revision]);
  function field(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
    if (name === 'route_id') {
      setRoute(null);
      setRouteError('');
      setLoading(!!value);
    }
  }
  const missing =
    route &&
    (!route.stops.length ||
      route.stops.some((s) => s.minutes_from_origin === null));
  const routeProblem = missing
    ? 'Tuyến chưa có đủ số phút tại các điểm dừng. Hãy hoàn thiện hành trình trong Quản lý tuyến xe trước.'
    : route?.status === 'INACTIVE'
      ? 'Tuyến đang ngừng hoạt động. Hãy chọn tuyến ACTIVE.'
      : route?.stops.some((s) => !s.is_active)
        ? 'Tuyến có bến đang ngừng hoạt động. Không thể phân lịch.'
        : '';
  const arrival =
    route && !missing
      ? arrivalAt(values.departure, route.stops.at(-1)?.minutes_from_origin)
      : null;
  const vehicle = options.vehicles.find((v) => v.id === values.vehicle_id);
  async function submit(e) {
    e.preventDefault();
    if (busy || locked) return;
    const departure = toUtc(values.departure);
    if (!departure || !arrival) {
      setError('Vui lòng chọn tuyến có đủ thời lượng và nhập ngày giờ hợp lệ.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        route_id: values.route_id,
        vehicle_id: values.vehicle_id,
        departure_at: departure,
        arrival_at: arrival,
      });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <StationDialog
      className="schedule-panel"
      title={
        schedule ? `Sửa lịch trình #${schedule.id}` : 'Thêm lịch trình mới'
      }
      onClose={onClose}
      busy={busy}
    >
      <p className="muted">Thời gian Việt Nam · Asia/Ho_Chi_Minh (UTC+7)</p>
      {locked && (
        <p className="route-note" role="status">
          {schedule.edit_block_reason}
        </p>
      )}
      <form onSubmit={submit}>
        <fieldset
          disabled={busy || locked}
          aria-describedby={error ? 'schedule-form-error' : undefined}
        >
          <label className="form-field">
            Tuyến chạy *
            <select
              required
              value={values.route_id}
              onChange={(e) => field('route_id', e.target.value)}
            >
              <option value="">Chọn tuyến xe</option>
              {options.routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.name}
                  {r.status !== 'ACTIVE' ? ' (Ngừng hoạt động)' : ''}
                </option>
              ))}
            </select>
          </label>
          {loading && <p role="status">Đang kiểm tra hành trình…</p>}
          {routeError && (
            <div className="alert alert-error" role="alert">
              {routeError}
              <button
                type="button"
                className="button"
                onClick={() => {
                  setLoading(true);
                  setRevision((v) => v + 1);
                }}
              >
                Tải lại tuyến
              </button>
            </div>
          )}
          {routeProblem && (
            <p className="alert alert-error" role="alert">
              {routeProblem}
            </p>
          )}
          {route && !routeProblem && (
            <p className="schedule-route-summary">
              {route.origin_name} → {route.destination_name}
              <br />
              {route.stops.length} điểm dừng ·{' '}
              {route.stops.at(-1).minutes_from_origin} phút
              <br />
              Hoạt động {route.operating_start}–{route.operating_end}
            </p>
          )}
          <label className="form-field">
            Xe chạy *
            <select
              required
              value={values.vehicle_id}
              onChange={(e) => field('vehicle_id', e.target.value)}
            >
              <option value="">Chọn phương tiện</option>
              {options.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_code} · {v.capacity} chỗ
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Sức chứa xe
            <input
              readOnly
              value={vehicle?.capacity ?? schedule?.capacity ?? ''}
            />
          </label>
          <p className="field-hint">
            Sức chứa lấy từ phương tiện. Hệ thống kiểm tra trùng lịch khi lưu.
          </p>
          <label className="form-field">
            Khởi hành (giờ Việt Nam) *
            <input
              type="datetime-local"
              step="1"
              required
              value={values.departure}
              onChange={(e) => field('departure', e.target.value)}
            />
          </label>
          <label className="form-field">
            Giờ đến dự kiến
            <input
              readOnly
              value={arrival ? displayTime(arrival) : ''}
              placeholder="Tự tính từ hành trình"
            />
          </label>
          <p className="field-hint">
            Giờ đến được tính từ số phút tại điểm cuối; không hỗ trợ chạy qua
            đêm.
          </p>
        </fieldset>
        {error && (
          <div
            id="schedule-form-error"
            className="alert alert-error"
            role="alert"
          >
            <img src="/icons/schedules/alert.svg" alt="" />
            {error}
          </div>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onClose}
          >
            Hủy thao tác
          </button>
          <button
            className="button button-primary"
            disabled={
              busy ||
              locked ||
              loading ||
              !!routeProblem ||
              !route ||
              !options.vehicles.length
            }
          >
            {busy ? 'Đang lưu…' : schedule ? 'Lưu thay đổi' : 'Lưu lịch trình'}
          </button>
        </div>
      </form>
    </StationDialog>
  );
}

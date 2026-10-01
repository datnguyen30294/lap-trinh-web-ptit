import { useState } from 'react';
import StationDialog from '../stations/StationDialog';
import ScheduleStatus from './ScheduleStatus';
import { displayTime, statusLabels } from '../../utils/scheduleTime';
export default function ScheduleStatusDialog({ schedule, onClose, onConfirm }) {
  const [target, setTarget] = useState(
      schedule.status === 'DEPARTED' ? 'COMPLETED' : 'CANCELLED',
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm(target);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <StationDialog
      title={`Đổi trạng thái lịch trình #${schedule.id}`}
      onClose={onClose}
      busy={busy}
    >
      <p className="confirm-station">
        <strong>
          {schedule.route_code} · {schedule.route_name}
        </strong>
        <span className="muted">
          {displayTime(schedule.departure_at)} · {schedule.vehicle_code}
        </span>
      </p>
      <ScheduleStatus status={schedule.status} />
      <label className="form-field">
        Trạng thái mới
        <select
          value={target}
          disabled={busy}
          onChange={(e) => {
            setTarget(e.target.value);
            setError('');
          }}
        >
          {(schedule.status === 'DEPARTED'
            ? ['COMPLETED']
            : ['CANCELLED', 'DEPARTED']
          ).map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </label>
      <p className="dialog-description">
        {target === 'CANCELLED'
          ? 'Hủy chuyến sẽ giữ nguyên lịch sử và không thể khôi phục. Nếu còn vé CONFIRMED, thao tác bị chặn. Hệ thống không tự hủy vé hoặc hoàn tiền.'
          : target === 'DEPARTED'
            ? 'Chỉ khởi hành từ giờ xuất phát đến trước giờ đến dự kiến. Hệ thống kiểm tra lại tuyến, bến, hành trình và xe.'
            : 'Chỉ hoàn thành sau giờ đến dự kiến. Thông tin chuyến và vé được giữ nguyên.'}
      </p>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="dialog-actions">
        <button className="button" disabled={busy} onClick={onClose}>
          Quay lại
        </button>
        <button
          className={`button ${target === 'CANCELLED' ? 'button-danger' : 'button-primary'}`}
          disabled={busy}
          onClick={confirm}
        >
          {busy ? 'Đang cập nhật…' : 'Xác nhận'}
        </button>
      </div>
    </StationDialog>
  );
}

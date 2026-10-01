import { useState } from 'react';
import StationDialog from '../stations/StationDialog';
import StationStatus from '../stations/StationStatus';
export default function RouteStatusDialog({ route, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = route.status === 'ACTIVE';
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <StationDialog
      title={active ? 'Ngừng hoạt động tuyến xe?' : 'Kích hoạt lại tuyến xe?'}
      onClose={onClose}
      busy={busy}
    >
      <p className="confirm-station">
        <strong>{route.name}</strong>
        <span className="muted">{route.code}</span>
      </p>
      <StationStatus active={active} />
      <p className="dialog-description">
        {active
          ? 'Tuyến sẽ ngừng hoạt động. Toàn bộ hành trình, lịch trình và lịch sử vé được giữ nguyên. Nếu chuyến tương lai còn vé đã xác nhận, thao tác sẽ bị chặn. Hệ thống không tự hủy vé.'
          : 'Hệ thống sẽ kiểm tra toàn bộ hành trình, trạng thái các bến và tính tương thích của lịch trình trước khi kích hoạt.'}
      </p>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="dialog-actions">
        <button className="button" disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button
          className={`button ${active ? 'button-danger' : 'button-primary'}`}
          disabled={busy}
          onClick={confirm}
        >
          {busy
            ? 'Đang cập nhật…'
            : active
              ? 'Xác nhận ngừng'
              : 'Xác nhận kích hoạt'}
        </button>
      </div>
    </StationDialog>
  );
}

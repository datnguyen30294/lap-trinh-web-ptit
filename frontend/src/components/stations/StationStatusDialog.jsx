import { useState } from 'react';
import StationDialog from './StationDialog';
import StationStatus from './StationStatus';

export default function StationStatusDialog({ station, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }
  return (
    <StationDialog
      title={
        station.is_active ? 'Ngừng hoạt động bến xe?' : 'Kích hoạt lại bến xe?'
      }
      onClose={onClose}
      busy={busy}
    >
      <p className="confirm-station">
        <strong>{station.name}</strong>
        <span className="muted">{station.code}</span>
      </p>
      <StationStatus active={station.is_active} />
      <p className="dialog-description">
        {station.is_active
          ? 'Bến sẽ chuyển sang ngừng hoạt động. Thông tin bến và lịch sử tuyến xe, vé vẫn được giữ nguyên. Bến thuộc tuyến đang hoạt động cần được xử lý tuyến trước.'
          : 'Bến sẽ chuyển sang đang hoạt động và có thể được sử dụng trở lại.'}
      </p>
      {error && (
        <div className="alert alert-error" role="alert">
          {error.message}
          {error.routes?.length > 0 && (
            <ul>
              {error.routes.map((route) => (
                <li key={route.id}>
                  {route.code} — {route.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="dialog-actions">
        <button className="button" onClick={onClose} disabled={busy}>
          Hủy
        </button>
        <button
          className={`button ${station.is_active ? 'button-danger' : 'button-primary'}`}
          disabled={busy}
          onClick={confirm}
        >
          {busy
            ? 'Đang cập nhật…'
            : station.is_active
              ? 'Xác nhận ngừng'
              : 'Xác nhận kích hoạt'}
        </button>
      </div>
    </StationDialog>
  );
}

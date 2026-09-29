import { useState } from 'react';
import StationDialog from './StationDialog';

const fields = [
  { name: 'code', label: 'Mã bến', max: 20, placeholder: 'Ví dụ: BX_MY_DINH' },
  {
    name: 'name',
    label: 'Tên bến xe',
    max: 160,
    placeholder: 'Nhập tên bến xe',
  },
  {
    name: 'address',
    label: 'Địa chỉ',
    max: 255,
    placeholder: 'Nhập địa chỉ bến xe',
  },
];
export default function StationForm({ station, onClose, onSave }) {
  const [values, setValues] = useState({
    code: station?.code ?? '',
    name: station?.name ?? '',
    address: station?.address ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const body = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()]),
    );
    const missing = fields.find((field) => !body[field.name]);
    if (missing) {
      setError(`Vui lòng nhập ${missing.label.toLowerCase()}.`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onSave(body);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <StationDialog
      title={station ? 'Sửa thông tin bến xe' : 'Thêm bến xe mới'}
      onClose={onClose}
      busy={busy}
    >
      <p className="dialog-description">Các trường có dấu * là bắt buộc.</p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {fields.map((field) => (
            <label className="form-field" key={field.name}>
              <span>
                {field.label} <span aria-hidden="true">*</span>
              </span>
              <input
                name={field.name}
                value={values[field.name]}
                required
                maxLength={field.max}
                placeholder={field.placeholder}
                autoComplete="off"
                aria-describedby={error ? 'station-form-error' : undefined}
                onChange={(event) =>
                  setValues({ ...values, [field.name]: event.target.value })
                }
              />
              <small>Tối đa {field.max} ký tự.</small>
            </label>
          ))}
        </fieldset>
        {error && (
          <div
            id="station-form-error"
            className="alert alert-error"
            role="alert"
          >
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
            Hủy
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            {busy ? 'Đang lưu…' : 'Lưu bến xe'}
          </button>
        </div>
      </form>
    </StationDialog>
  );
}

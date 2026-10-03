import { useState } from 'react';
import StationDialog from '../stations/StationDialog';
import { bookingsApi } from '../../services/bookingsApi';
import { tripDateTime } from '../../utils/bookingFormat';

export default function CancelTicketDialog({ ticket, onClose, onCancelled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function cancel() {
    setBusy(true);
    setError('');
    try {
      const updated = await bookingsApi.cancel(ticket.id);
      onCancelled(updated);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <StationDialog
      title="Hủy vé này?"
      onClose={onClose}
      busy={busy}
      className="booking-cancel-dialog"
    >
      <p>
        Bạn có chắc chắn muốn hủy vé {ticket.booking_code} (
        {ticket.from_station} → {ticket.to_station},{' '}
        {tripDateTime(ticket.pickup_at)})? Thao tác này không thể hoàn tác. Chỗ
        đã đặt sẽ được hoàn lại ngay sau khi hủy.
      </p>
      {error && (
        <p className="booking-error" role="alert">
          {error}
        </p>
      )}
      <div className="booking-dialog-actions">
        <button
          className="booking-button outline"
          disabled={busy}
          onClick={onClose}
        >
          Không
        </button>
        <button
          className="booking-button danger"
          disabled={busy}
          onClick={cancel}
        >
          {busy ? 'Đang hủy…' : 'Có, hủy vé'}
        </button>
      </div>
    </StationDialog>
  );
}

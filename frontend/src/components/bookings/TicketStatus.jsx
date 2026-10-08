import { bookingStatusLabels } from '../../utils/bookingFormat';

export default function TicketStatus({ status }) {
  return (
    <span className={`booking-status ${status.toLowerCase()}`}>
      {bookingStatusLabels[status]}
    </span>
  );
}

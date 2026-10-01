import { statusLabels } from '../../utils/scheduleTime';
export default function ScheduleStatus({ status }) {
  return (
    <span className={`schedule-status schedule-${status.toLowerCase()}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

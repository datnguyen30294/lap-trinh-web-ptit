import AppLink from '../AppLink';
import { tripBookingLink } from '../../utils/bookingFormat';

// Trang đặt vé nhận mã chuyến và hai bến, rồi tải lại giá và chỗ trống từ API.
export default function JourneyBookingLink({ journey }) {
  const href = tripBookingLink({
    id: journey.schedule_id,
    from_station_id: journey.boarding_station.id,
    to_station_id: journey.alighting_station.id,
  });
  return (
    <AppLink className="jp-detail-buy" href={href}>
      Mua vé
    </AppLink>
  );
}

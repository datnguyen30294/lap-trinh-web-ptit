const dateOptions = { timeZone: 'Asia/Ho_Chi_Minh' };
export const money = (value) => `${Number(value).toLocaleString('vi-VN')} đ`;
export const tripDate = (value) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        ...dateOptions,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : 'Chưa có thời gian';
export const tripTime = (value) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        ...dateOptions,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(value))
    : 'Chưa có thời gian';
export const tripDateTime = (value) =>
  `${tripDate(value)} · ${tripTime(value)}`;
export const vietnamToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    ...dateOptions,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const bookingStatusLabels = {
  CONFIRMED: 'Đã đặt',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};
export const searchParams = () =>
  Object.fromEntries(new URLSearchParams(window.location.search));
export const tripBookingLink = (trip) =>
  `/user/bookings/new?${new URLSearchParams({
    trip: trip.id,
    from: trip.from_station_id,
    to: trip.to_station_id,
  })}`;

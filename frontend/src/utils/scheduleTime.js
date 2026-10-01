const vietnam = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
export const displayTime = (value) =>
  value ? vietnam.format(new Date(value)) : 'Chưa có thời gian';
export const toLocalInput = (value) =>
  value
    ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 19)
    : '';
export function toUtc(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const time = Date.parse(`${value}+07:00`);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
export function arrivalAt(local, minutes) {
  const utc = toUtc(local);
  return utc && Number.isInteger(minutes) && minutes > 0
    ? new Date(Date.parse(utc) + minutes * 60000).toISOString()
    : null;
}
export const statusLabels = {
  SCHEDULED: 'Đã lên lịch',
  DEPARTED: 'Đã khởi hành',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

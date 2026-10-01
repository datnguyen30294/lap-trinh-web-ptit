import { BadRequestException } from '@nestjs/common';
export function utcTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))
    throw new BadRequestException('Ngày giờ phải là ISO UTC, kết thúc bằng Z.');
  const ms = Date.parse(value);
  const normalized = value.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_, fraction: string | undefined) => `.${(fraction ?? '').padEnd(3, '0')}Z`,
  );
  if (
    !Number.isFinite(ms) ||
    new Date(ms).toISOString() !== normalized ||
    +value.slice(0, 4) < 1000 ||
    +value.slice(0, 4) > 9998
  )
    throw new BadRequestException('Ngày giờ không hợp lệ (năm 1000–9998).');
  return ms;
}
export function dayStart(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('Ngày lọc phải có định dạng YYYY-MM-DD.');
  return utcTime(`${value}T00:00:00Z`) - 7 * 3600000;
}
export const sqlTime = (ms: number) =>
  new Date(ms).toISOString().slice(0, 23).replace('T', ' ');
export const vietnamTime = (ms: number) =>
  new Date(ms + 7 * 3600000).toISOString();

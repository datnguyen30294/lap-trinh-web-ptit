import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
export class ListStationsDto {
  @Transform(integer)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải từ 1.' })
  @Max(1000000, { message: 'Trang tối đa 1000000.' })
  page = 1;
  @Transform(integer)
  @IsInt({ message: 'Số dòng phải là số nguyên.' })
  @Min(1, { message: 'Số dòng phải từ 1.' })
  @Max(100, { message: 'Mỗi trang tối đa 100 dòng.' })
  limit = 10;
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Từ khóa phải là chuỗi.' })
  @MaxLength(255, { message: 'Từ khóa tối đa 255 ký tự.' })
  search?: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['true', 'false'], {
    message: 'Bộ lọc trạng thái phải là true hoặc false.',
  })
  is_active?: string;
}

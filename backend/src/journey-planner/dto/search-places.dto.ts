import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;

export class SearchPlacesDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().normalize('NFC') : value,
  )
  @IsString({ message: 'Từ khóa phải là chuỗi.' })
  @MaxLength(255, { message: 'Từ khóa tối đa 255 ký tự.' })
  search = '';

  @Transform(integer)
  @IsInt({ message: 'Trang phải là số nguyên.' })
  @Min(1, { message: 'Trang phải từ 1.' })
  @Max(1000000, { message: 'Trang tối đa 1000000.' })
  page = 1;

  @Transform(integer)
  @IsInt({ message: 'Số gợi ý phải là số nguyên.' })
  @Min(1, { message: 'Số gợi ý phải từ 1.' })
  @Max(20, { message: 'Mỗi lần tải tối đa 20 gợi ý.' })
  limit = 8;
}

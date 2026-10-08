import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Do not turn blank strings, arrays or booleans into coordinates.
const coordinate = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)
    ? Number(value)
    : value;

export class SearchJourneysDto {
  @Transform(coordinate)
  @IsNumber({}, { message: 'Vĩ độ phải là số hợp lệ.' })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Transform(coordinate)
  @IsNumber({}, { message: 'Kinh độ phải là số hợp lệ.' })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'Mã điểm đến không hợp lệ.' })
  @MaxLength(20)
  destination_station_id!: string;
}

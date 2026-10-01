import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const time = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
    ? `${value}:00`
    : value;
export class StopDto {
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/, { message: 'ID bến không hợp lệ.' })
  station_id: string;
  @IsInt({ message: 'Thứ tự điểm dừng phải là số nguyên.' })
  @Min(1)
  @Max(65535)
  stop_order: number;
  // NULL is accepted only for unchanged legacy journeys, enforced by the service.
  @ValidateIf((_, value) => value !== null)
  @IsInt({ message: 'Số phút phải là số nguyên.' })
  @Min(0)
  @Max(65535)
  minutes_from_origin: number | null;
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Số km phải là số có tối đa 2 chữ số thập phân.' },
  )
  @Min(0)
  @Max(999999.99)
  km_from_origin: number;
}
export class RouteDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã tuyến.' })
  @MaxLength(20, { message: 'Mã tuyến tối đa 20 ký tự.' })
  code: string;
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên tuyến.' })
  @MaxLength(180, { message: 'Tên tuyến tối đa 180 ký tự.' })
  name: string;
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/, { message: 'ID bến đầu không hợp lệ.' })
  origin_station_id: string;
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/, { message: 'ID bến cuối không hợp lệ.' })
  destination_station_id: string;
  @Transform(time)
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message: 'Giờ bắt đầu không hợp lệ.',
  })
  operating_start: string;
  @Transform(time)
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message: 'Giờ kết thúc không hợp lệ.',
  })
  operating_end: string;
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Khoảng cách phải là số có tối đa 2 chữ số thập phân.' },
  )
  @Min(0.01)
  @Max(999999.99)
  distance_km: number;
  @IsArray()
  @ArrayMinSize(2, { message: 'Hành trình cần ít nhất hai bến.' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => StopDto)
  stops: StopDto[];
}
export class CreateRouteDto extends RouteDto {
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'Trạng thái tuyến không hợp lệ.' })
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
}
export class RouteStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'Trạng thái tuyến không hợp lệ.' })
  status: 'ACTIVE' | 'INACTIVE';
}

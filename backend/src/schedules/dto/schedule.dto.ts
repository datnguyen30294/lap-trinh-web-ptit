import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
export class PageDto {
  @Transform(integer) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Transform(integer) @IsInt() @Min(1) @Max(100) limit = 10;
  @ValidateIf((_, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(255)
  search?: string;
}
export class ListSchedulesDto extends PageDto {
  @ValidateIf((_, v) => v !== undefined)
  @Matches(/^[1-9][0-9]{0,19}$/, { message: 'ID tuyến không hợp lệ.' })
  route_id?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsIn(['SCHEDULED', 'DEPARTED', 'COMPLETED', 'CANCELLED'])
  status?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(10)
  date_from?: string;
  @ValidateIf((_, v) => v !== undefined)
  @IsString()
  @MaxLength(10)
  date_to?: string;
}
export class ScheduleDto {
  @Matches(/^[1-9][0-9]{0,19}$/, { message: 'ID tuyến không hợp lệ.' })
  route_id: string;
  @Matches(/^[1-9][0-9]{0,19}$/, { message: 'ID xe không hợp lệ.' })
  vehicle_id: string;
  @IsString() @MaxLength(24) departure_at: string;
  @IsString() @MaxLength(24) arrival_at: string;
}
export class ScheduleStatusDto {
  @IsIn(['DEPARTED', 'COMPLETED', 'CANCELLED'], {
    message: 'Trạng thái đích không hợp lệ.',
  })
  status: 'DEPARTED' | 'COMPLETED' | 'CANCELLED';
}

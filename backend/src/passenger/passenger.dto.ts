import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
export class PassengerRoutesDto {
  @Transform(integer) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Transform(integer) @IsInt() @Min(1) @Max(50) limit = 10;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/)
  from_station_id?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/)
  to_station_id?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/)
  route_id?: string;
}

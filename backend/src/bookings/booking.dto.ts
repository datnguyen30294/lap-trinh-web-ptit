import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const integer = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PageDto {
  @Transform(integer) @IsInt() @Min(1) @Max(1000000) page = 1;
  @Transform(integer) @IsInt() @Min(1) @Max(50) limit = 10;
}

export class TripSegmentDto {
  @IsString() @Matches(/^[1-9][0-9]{0,19}$/) from_station_id: string;
  @IsString() @Matches(/^[1-9][0-9]{0,19}$/) to_station_id: string;
}

export class TripSearchDto extends PageDto {
  @IsString() @Matches(/^[1-9][0-9]{0,19}$/) from_station_id: string;
  @IsString() @Matches(/^[1-9][0-9]{0,19}$/) to_station_id: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[1-9][0-9]{0,19}$/)
  route_id?: string;
}

export class PassengerDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  passenger_name: string;
  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^(?=(?:\D*\d){8,15}\D*$)\+?[0-9 ()-]+$/)
  contact_phone: string;
}

export class CreateBookingDto extends TripSegmentDto {
  @IsString() @Matches(/^[1-9][0-9]{0,19}$/) schedule_id: string;
  @IsInt() @Min(0) @Max(99999999) unit_price: number;
  @IsUUID('4') request_id: string;
  // Capacity is SMALLINT UNSIGNED. The real limit is checked under a DB lock.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(65535)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers: PassengerDto[];
}

export class BookingListDto extends PageDto {
  @IsIn(['ALL', 'CONFIRMED', 'COMPLETED', 'CANCELLED']) filter = 'ALL';
}

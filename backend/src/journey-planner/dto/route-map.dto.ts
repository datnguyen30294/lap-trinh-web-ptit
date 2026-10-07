import { IsString, Matches, MaxLength } from 'class-validator';

export class RouteMapDto {
  @IsString()
  @Matches(/^[1-9]\d*$/)
  @MaxLength(20)
  route_id!: string;

  @IsString()
  @Matches(/^[1-9]\d*$/)
  @MaxLength(20)
  from_station_id!: string;

  @IsString()
  @Matches(/^[1-9]\d*$/)
  @MaxLength(20)
  to_station_id!: string;
}

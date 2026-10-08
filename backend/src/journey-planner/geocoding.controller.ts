import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PassengerGuard } from '../passenger/passenger.guard.js';
import { GeocodingService } from './geocoding.service.js';

export class GeocodeQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  search!: string;
}

@Controller('journey-planner/geocoding')
@UseGuards(PassengerGuard)
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Get()
  async search(@Query() query: GeocodeQueryDto) {
    return { items: await this.geocoding.search(query.search) };
  }
}

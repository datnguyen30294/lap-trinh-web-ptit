import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PassengerGuard } from '../passenger/passenger.guard.js';
import { SearchPlacesDto } from './dto/search-places.dto.js';
import { PlacesService } from './places.service.js';

@Controller('journey-planner/places')
@UseGuards(PassengerGuard)
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  search(@Query() query: SearchPlacesDto) {
    return this.places.search(query);
  }
}

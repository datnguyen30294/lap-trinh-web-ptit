import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PassengerGuard } from '../passenger/passenger.guard.js';
import { SearchJourneysDto } from './dto/search-journeys.dto.js';
import { JourneysService } from './journeys.service.js';
import { JourneyDetailDto } from './dto/journey-detail.dto.js';

@Controller('journey-planner/journeys')
@UseGuards(PassengerGuard)
export class JourneysController {
  constructor(private readonly journeys: JourneysService) {}

  @Get()
  search(@Query() query: SearchJourneysDto) {
    return this.journeys.search(query);
  }

  @Get('detail')
  detail(@Query() query: JourneyDetailDto) {
    return this.journeys.detail(query);
  }
}

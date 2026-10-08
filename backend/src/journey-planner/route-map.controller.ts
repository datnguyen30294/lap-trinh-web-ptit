import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PassengerGuard } from '../passenger/passenger.guard.js';
import { RouteMapDto } from './dto/route-map.dto.js';
import { RouteMapService } from './route-map.service.js';

@Controller('journey-planner/route-map')
@UseGuards(PassengerGuard)
export class RouteMapController {
  constructor(private readonly maps: RouteMapService) {}

  @Get()
  getMap(@Query() query: RouteMapDto) {
    return this.maps.getMap(query);
  }
}

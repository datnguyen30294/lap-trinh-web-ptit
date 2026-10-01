import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PassengerGuard } from './passenger.guard.js';
import { PassengerService } from './passenger.service.js';
import { PassengerRoutesDto } from './passenger.dto.js';

@Controller('passenger')
@UseGuards(PassengerGuard)
export class PassengerController {
  constructor(private readonly passenger: PassengerService) {}
  @Get('stations') stations() {
    return this.passenger.stations();
  }
  @Get('routes') routes(@Query() query: PassengerRoutesDto) {
    return this.passenger.routes(query);
  }
}

import { Controller, Get } from '@nestjs/common';
import { StationsService } from './stations.service.js';

@Controller('stations')
export class StationsController {
  constructor(
    private readonly stationsService: StationsService,
  ) {}

  @Get()
  findAll() {
    return this.stationsService.findAll();
  }
}
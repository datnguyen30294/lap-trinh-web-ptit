import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { StationsService } from './stations.service.js';
import { StationDto, StationStatusDto } from './dto/station.dto.js';
import { ListStationsDto } from './dto/list-stations.dto.js';
import { StationIdPipe } from './station-id.pipe.js';
@Controller('stations')
@UseGuards(AdminGuard)
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}
  @Get() findAll(@Query() query: ListStationsDto) {
    return this.stationsService.findAll(query);
  }
  @Post() create(@Body() dto: StationDto) {
    return this.stationsService.create(dto);
  }
  @Patch(':id') update(
    @Param('id', StationIdPipe) id: string,
    @Body() dto: StationDto,
  ) {
    return this.stationsService.update(id, dto);
  }
  @Patch(':id/status') status(
    @Param('id', StationIdPipe) id: string,
    @Body() dto: StationStatusDto,
  ) {
    return this.stationsService.setStatus(id, dto.is_active);
  }
}

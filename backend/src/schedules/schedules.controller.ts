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
import { RouteIdPipe } from '../routes/route-id.pipe.js';
import { SchedulesService } from './schedules.service.js';
import {
  ListSchedulesDto,
  PageDto,
  ScheduleDto,
  ScheduleStatusDto,
} from './dto/schedule.dto.js';
@Controller('schedules')
@UseGuards(AdminGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}
  @Get() list(@Query() query: ListSchedulesDto) {
    return this.schedules.list(query);
  }
  @Get('vehicles') vehicles(@Query() query: PageDto) {
    return this.schedules.vehicles(query);
  }
  @Get(':id') detail(@Param('id', RouteIdPipe) id: string) {
    return this.schedules.detail(id);
  }
  @Post() create(@Body() dto: ScheduleDto) {
    return this.schedules.create(dto);
  }
  @Patch(':id') update(
    @Param('id', RouteIdPipe) id: string,
    @Body() dto: ScheduleDto,
  ) {
    return this.schedules.update(id, dto);
  }
  @Patch(':id/status') status(
    @Param('id', RouteIdPipe) id: string,
    @Body() dto: ScheduleStatusDto,
  ) {
    return this.schedules.setStatus(id, dto.status);
  }
}

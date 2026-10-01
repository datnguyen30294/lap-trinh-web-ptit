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
import { RoutesService } from './routes.service.js';
import { CreateRouteDto, RouteDto, RouteStatusDto } from './dto/route.dto.js';
import { ListRoutesDto } from './dto/list-routes.dto.js';
import { RouteIdPipe } from './route-id.pipe.js';
@Controller('routes')
@UseGuards(AdminGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}
  @Get() list(@Query() query: ListRoutesDto) {
    return this.routes.list(query);
  }
  @Get(':id') detail(@Param('id', RouteIdPipe) id: string) {
    return this.routes.detail(id);
  }
  @Post() create(@Body() dto: CreateRouteDto) {
    return this.routes.create(dto);
  }
  @Patch(':id') update(
    @Param('id', RouteIdPipe) id: string,
    @Body() dto: RouteDto,
  ) {
    return this.routes.update(id, dto);
  }
  @Patch(':id/status') status(
    @Param('id', RouteIdPipe) id: string,
    @Body() dto: RouteStatusDto,
  ) {
    return this.routes.setStatus(id, dto.status);
  }
}

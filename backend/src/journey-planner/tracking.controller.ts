import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { PassengerGuard } from '../passenger/passenger.guard.js';
import { StartTrackingDto } from './dto/start-tracking.dto.js';
import { JourneysService } from './journeys.service.js';
import { trackingState } from './tracking-state.js';

@Controller('journey-planner/tracking')
@UseGuards(PassengerGuard)
export class TrackingController {
  private readonly starting = new Set<string>();
  constructor(private readonly journeys: JourneysService) {}

  @Get()
  current(@Req() req: Request) {
    return {
      active: req.session.activeJourney
        ? trackingState(req.session.activeJourney)
        : null,
    };
  }

  @Post()
  @HttpCode(200)
  async start(@Req() req: Request, @Body() query: StartTrackingDto) {
    const active = req.session.activeJourney;
    if (active) {
      if (
        active.journey.route_id !== query.route_id ||
        active.journey.alighting_station.id !== query.destination_station_id ||
        active.origin.latitude !== query.latitude ||
        active.origin.longitude !== query.longitude
      )
        throw new ConflictException(
          'Hãy kết thúc hành trình hiện tại trước khi chọn hành trình khác.',
        );
      return { active: trackingState(active) };
    }
    if (this.starting.has(req.sessionID))
      throw new ConflictException('Đang bắt đầu hành trình. Vui lòng chờ.');
    this.starting.add(req.sessionID);
    try {
      const journey = await this.journeys.detail(query);
      req.session.activeJourney = {
        id: randomUUID(),
        started_at: journey.updated_at,
        origin: {
          latitude: query.latitude,
          longitude: query.longitude,
          ...(query.origin_label ? { label: query.origin_label } : {}),
        },
        journey,
      };
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve())),
      );
      return { active: trackingState(req.session.activeJourney) };
    } finally {
      this.starting.delete(req.sessionID);
    }
  }

  @Post(':id/end')
  @HttpCode(200)
  async end(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    if (this.starting.has(req.sessionID))
      throw new ConflictException(
        'Hành trình đang khởi tạo. Vui lòng thử lại.',
      );
    const active = req.session.activeJourney;
    if (active && active.id !== id)
      throw new ConflictException(
        'Hành trình đã thay đổi. Vui lòng tải lại trang.',
      );
    delete req.session.activeJourney;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );
    return { ended: true };
  }
}

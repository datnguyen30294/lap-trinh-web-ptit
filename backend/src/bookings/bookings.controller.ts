import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PassengerGuard } from '../passenger/passenger.guard.js';
import {
  BookingListDto,
  CreateBookingDto,
  TripSearchDto,
  TripSegmentDto,
} from './booking.dto.js';
import { BookingsService } from './bookings.service.js';

@Controller('bookings')
@UseGuards(PassengerGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('trips') trips(@Query() query: TripSearchDto) {
    return this.bookings.trips(query);
  }
  @Get('trips/:id') trip(
    @Param('id') id: string,
    @Query() query: TripSegmentDto,
  ) {
    return this.bookings.trip(id, query);
  }
  @Post() create(@Req() req: Request, @Body() body: CreateBookingDto) {
    return this.bookings.create(req.session.userId!, body);
  }
  @Get() list(@Req() req: Request, @Query() query: BookingListDto) {
    return this.bookings.list(req.session.userId!, query);
  }
  @Get('receipt/:requestId') receipt(
    @Req() req: Request,
    @Param('requestId') requestId: string,
  ) {
    return this.bookings.receipt(req.session.userId!, requestId);
  }
  @Get(':id') detail(@Req() req: Request, @Param('id') id: string) {
    return this.bookings.detail(req.session.userId!, id);
  }
  @Patch(':id/cancel') cancel(@Req() req: Request, @Param('id') id: string) {
    return this.bookings.cancel(req.session.userId!, id);
  }
}

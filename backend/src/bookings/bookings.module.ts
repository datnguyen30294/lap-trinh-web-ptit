import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PassengerGuard } from '../passenger/passenger.guard.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BookingsController],
  providers: [PassengerGuard, BookingsService],
})
export class BookingsModule {}

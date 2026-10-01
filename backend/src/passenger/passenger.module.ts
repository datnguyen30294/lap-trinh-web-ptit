import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PassengerController } from './passenger.controller.js';
import { PassengerGuard } from './passenger.guard.js';
import { PassengerService } from './passenger.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PassengerController],
  providers: [PassengerGuard, PassengerService],
})
export class PassengerModule {}

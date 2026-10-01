import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoutesModule } from '../routes/routes.module.js';
import { SchedulesController } from './schedules.controller.js';
import { SchedulesService } from './schedules.service.js';
@Module({
  imports: [AuthModule, RoutesModule],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}

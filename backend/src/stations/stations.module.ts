import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Station } from './station.entity.js';
import { StationsService } from './stations.service.js';
import { StationsController } from './stations.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Station])],
  providers: [StationsService],
  controllers: [StationsController],
})
export class StationsModule {}
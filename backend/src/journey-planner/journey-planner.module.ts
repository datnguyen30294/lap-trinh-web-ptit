import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PassengerGuard } from '../passenger/passenger.guard.js';
import { PlacesController } from './places.controller.js';
import { PlacesService } from './places.service.js';
import { JourneysController } from './journeys.controller.js';
import { JourneysService } from './journeys.service.js';
import { RouteMapController } from './route-map.controller.js';
import { RouteMapService } from './route-map.service.js';
import { RoadRoutingService } from './road-routing.service.js';
import { TrackingController } from './tracking.controller.js';
import { GeocodingController } from './geocoding.controller.js';
import { GeocodingService } from './geocoding.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    PlacesController,
    JourneysController,
    RouteMapController,
    TrackingController,
    GeocodingController,
  ],
  providers: [
    PassengerGuard,
    PlacesService,
    JourneysService,
    RouteMapService,
    RoadRoutingService,
    GeocodingService,
  ],
})
export class JourneyPlannerModule {}

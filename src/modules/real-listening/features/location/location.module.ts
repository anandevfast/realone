import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { LocationRepository } from '../../infrastructure/repositories/location.repository';
import { SocialDatabaseModule } from '../../infrastructure/social-database.module';

@Module({
  imports: [SocialDatabaseModule],
  controllers: [LocationController],
  providers: [LocationService, LocationRepository],
})
export class LocationModule {}

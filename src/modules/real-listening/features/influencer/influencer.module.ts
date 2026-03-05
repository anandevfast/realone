import { Module } from '@nestjs/common';
import { InfluencerController } from './influencer.controller';
import { InfluencerService } from './influencer.service';
import { InfluencerRepository } from '../../infrastructure/repositories/influencer.repository';
import { SocialDatabaseModule } from '../../infrastructure/social-database.module';

@Module({
  imports: [SocialDatabaseModule],
  controllers: [InfluencerController],
  providers: [InfluencerService, InfluencerRepository],
})
export class InfluencerModule {}

import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from '../../infrastructure/repositories/analytics.repository';
import { SocialDatabaseModule } from '../../infrastructure/social-database.module';

@Module({
  imports: [SocialDatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}

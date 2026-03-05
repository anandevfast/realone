import { Module } from '@nestjs/common';
import { TrendController } from './trend.controller';
import { TrendService } from './trend.service';
import { TrendRepository } from '../../infrastructure/repositories/trend.repository';
import { SocialDatabaseModule } from '../../infrastructure/social-database.module';

@Module({
  imports: [SocialDatabaseModule],
  controllers: [TrendController],
  providers: [TrendService, TrendRepository],
})
export class TrendModule {}

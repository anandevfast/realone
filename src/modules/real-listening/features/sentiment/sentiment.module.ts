import { Module } from '@nestjs/common';
import { SentimentController } from './sentiment.controller';
import { SentimentService } from './sentiment.service';
import { SentimentRepository } from '../../infrastructure/repositories/sentiment.repository';
import { SocialDatabaseModule } from '../../infrastructure/social-database.module';

@Module({
  imports: [SocialDatabaseModule],
  controllers: [SentimentController],
  providers: [SentimentService, SentimentRepository],
})
export class SentimentModule {}

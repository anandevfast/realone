import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SentimentService } from './sentiment.service';
import { SentimentFilterDTO } from './dto/sentiment-filter.dto';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';

@ApiTags('Real Listening - Sentiment')
@Controller('sentiment')
export class SentimentController {
  constructor(private readonly sentimentService: SentimentService) {}

  @Post('query')
  @RateLimit({ limit: 10, window: 60 })
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: SentimentFilterDTO) {
    return await this.sentimentService.query(dto);
  }
}

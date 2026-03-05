import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDTO } from './dto/analytics-filter.dto';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';

@ApiTags('Real Listening - Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('query')
  @RateLimit({ limit: 10, window: 60 })
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: AnalyticsFilterDTO) {
    return await this.analyticsService.query(dto);
  }
}

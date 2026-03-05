import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TrendService } from './trend.service';
import { TrendFilterDTO } from './dto/trend-filter.dto';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';

@ApiTags('Real Listening - Trend')
@Controller('trend')
export class TrendController {
  constructor(private readonly trendService: TrendService) {}

  @Post('query')
  @RateLimit({ limit: 10, window: 60 })
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: TrendFilterDTO) {
    return await this.trendService.query(dto);
  }
}

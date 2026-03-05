import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InfluencerService } from './influencer.service';
import { InfluencerFilterDTO } from './dto/influencer-filter.dto';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';

@ApiTags('Real Listening - Influencer')
@Controller('influencer')
export class InfluencerController {
  constructor(private readonly influencerService: InfluencerService) {}

  @Post('query')
  @RateLimit({ limit: 10, window: 60 })
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: InfluencerFilterDTO) {
    return await this.influencerService.query(dto);
  }
}

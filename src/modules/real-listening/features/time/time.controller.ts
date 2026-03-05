import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TimeService } from './time.service';
import { TimeFilterDTO } from './dto/time-filter.dto';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';

@ApiTags('Real Listening - Time')
@Controller('time')
export class TimeController {
  constructor(private readonly timeService: TimeService) {}

  @Post('query')
  @RateLimit({ limit: 10, window: 60 })
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: TimeFilterDTO) {
    return await this.timeService.query(dto);
  }
}

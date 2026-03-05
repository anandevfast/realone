import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocationService } from './location.service';
import { LocationFilterDTO } from './dto/location-filter.dto';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';

@ApiTags('Real Listening - Location')
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post('query')
  @RateLimit({ limit: 10, window: 60 })
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: LocationFilterDTO) {
    return await this.locationService.query(dto);
  }
}

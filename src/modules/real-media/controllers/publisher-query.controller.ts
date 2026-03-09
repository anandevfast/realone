import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Real Media - Publishers')
@Controller('real-media/publishers')
export class PublisherQueryController {
  @Post('query')
  async query(@Body() dto?: any) {
    return {
      result: {
        channel: dto.channel,
      },
    };
  }

  @Get()
  getContentById(@Query('id') id: string) {
    return { id: id };
  }
}

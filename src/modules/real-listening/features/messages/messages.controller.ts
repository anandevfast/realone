import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { MessageFilterDTO } from './dto/message-filter.dto';
import { MessagesService } from './messages.service';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';

@ApiTags('Real Listening - Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('query')
  @RateLimit({ limit: 15, window: 60 })
  @HttpCode(HttpStatus.OK)
  async findMessageList(@Body() dto: MessageFilterDTO) {
    return await this.messagesService.findMessagesList(dto);
  }

  @Post('count')
  @RateLimit({ limit: 30, window: 60 })
  @HttpCode(HttpStatus.OK)
  async countMessages(@Body() dto: MessageFilterDTO) {
    return await this.messagesService.countMessages(dto);
  }
}

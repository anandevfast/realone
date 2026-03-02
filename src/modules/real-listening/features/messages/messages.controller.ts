import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { MessageFilterDTO } from './dto/message-filter.dto';
import { MessagesService } from './messages.service';
import { RateLimit } from 'src/core/rate-limit/rate-limit.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Real Listening - Message')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('query')
  @RateLimit({ limit: 15, window: 60 })
  @HttpCode(HttpStatus.OK)
  async findMessageList(@Body() dto: MessageFilterDTO) {
    return await this.messagesService.findMessagesList(dto);
  }
}

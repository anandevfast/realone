import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageFilterDTO } from './dto/message-filter.dto';
import { MessagesRepository } from '../../infrastructure/repositories/messages.repository';

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  async findMessagesList(dto: MessageFilterDTO) {
    try {
      return await this.messagesRepository.findByFilter(dto);
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }
}

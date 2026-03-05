import { BadRequestException, Injectable } from '@nestjs/common';
import { MessageFilterDTO } from './dto/message-filter.dto';
import { MessagesRepository } from '../../infrastructure/repositories/messages.repository';

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}

  async findMessagesList(dto: MessageFilterDTO) {
    try {
      return await this.messagesRepository.findByFilterWithPagination(dto, dto.email);
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }

  async countMessages(dto: MessageFilterDTO) {
    try {
      const total_count = await this.messagesRepository.countByFilter(dto, dto.email);
      return { total_count };
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }
}

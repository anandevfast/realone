import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesDatabaseModule } from '../../infrastructure/messages-database.module';

@Module({
  imports: [MessagesDatabaseModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}

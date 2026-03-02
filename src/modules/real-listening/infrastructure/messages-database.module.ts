import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  SocialMessage,
  SocialMessageSchema,
} from './schemas/social-message.schema';
import { MessagesRepository } from './repositories/messages.repository';
import { SocialQueryBuilderService } from '../domain/services/social-query-builder.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SocialMessage.name, schema: SocialMessageSchema },
    ]),
  ],
  providers: [MessagesRepository, SocialQueryBuilderService],
  exports: [MessagesRepository],
})
export class MessagesDatabaseModule {}


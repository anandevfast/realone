import { Module } from '@nestjs/common';

import { MessagesRepository } from './repositories/messages.repository';
import { SocialDatabaseModule } from './social-database.module';

@Module({
  imports: [SocialDatabaseModule],
  providers: [MessagesRepository],
  exports: [MessagesRepository],
})
export class MessagesDatabaseModule {}

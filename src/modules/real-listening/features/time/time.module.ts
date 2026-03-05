import { Module } from '@nestjs/common';
import { TimeController } from './time.controller';
import { TimeService } from './time.service';
import { TimeRepository } from '../../infrastructure/repositories/time.repository';
import { SocialDatabaseModule } from '../../infrastructure/social-database.module';

@Module({
  imports: [SocialDatabaseModule],
  controllers: [TimeController],
  providers: [TimeService, TimeRepository],
})
export class TimeModule {}

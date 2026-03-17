import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SCHEDULER_TIMEZONE } from '../scheduler.constants';

@Injectable()
export class ExampleTask {
  private readonly logger = new Logger(ExampleTask.name);

  // @Cron('* * * * *', { timeZone: SCHEDULER_TIMEZONE })
  // async handle() {
  //   this.logger.log('ExampleTask running...');
  //   // logic here
  // }
}

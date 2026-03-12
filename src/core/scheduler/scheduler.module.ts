import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ExampleTask } from './tasks/example.task';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    ExampleTask,
    // เพิ่ม task ใหม่ที่นี่
  ],
})
export class SchedulerModule {}

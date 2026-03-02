import { Module } from '@nestjs/common';
import { MessagesModule } from './features/messages/messages.module';
import { RouterModule } from '@nestjs/core';

@Module({
  imports: [
    MessagesModule,
    RouterModule.register([
      {
        path: 'real-listening',
        module: RealListeningModule, // กำหนด Prefix ให้ตัวแม่
        children: [
          {
            path: '/', // ให้ MessagesModule ต่อท้ายตัวแม่ตรงๆ
            module: MessagesModule,
          },
        ],
      },
    ]),
  ],
})
export class RealListeningModule {}

import { Module } from '@nestjs/common';
import { RateLimitInterceptor } from './rate-limit.interceptor';

@Module({
  providers: [RateLimitInterceptor],
  exports: [RateLimitInterceptor],
})
export class RateLimitModule {}

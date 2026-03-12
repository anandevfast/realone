import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AppConfigModule } from './config/config.module';
import { TypeConfigService } from './config/typed-config.service';

import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RequestIdMiddleware } from './core/middleware/request-id.middleware';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { LoggerModule } from './core/logger/logger.module';
import { RateLimitModule } from './core/rate-limit/rate-limit.module';
import { RateLimitInterceptor } from './core/rate-limit/rate-limit.interceptor';
import { CacheModule } from '@nestjs/cache-manager';
import { ResponseInterceptor } from './core/interceptors/response.interceptor';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { RealMediaModule } from './modules/real-media/real-media.module';
import { RealListeningModule } from './modules/real-listening/real-listening.module';
import { MongoModule } from './core/database/mongo.module';
import { SchedulerModule } from './core/scheduler/scheduler.module';

@Module({
  imports: [
    AppConfigModule,
    AuthModule,
    LoggerModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [AppConfigModule],
      inject: [TypeConfigService],
      useFactory: (config: TypeConfigService) => {
        const cache = config.cache;
        return {
          ttl: cache?.ttl ?? 60,
          max: cache?.max ?? 1000,
        };
      },
    }),
    RateLimitModule,
    MongoModule,
    SchedulerModule,
    RealMediaModule,
    RealListeningModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

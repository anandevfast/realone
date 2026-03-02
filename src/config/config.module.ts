// src/config/config.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { appConfig } from './app.config';
import { authConfig } from './auth.config';
import { databaseConfig } from './database.config';
import { integrationConfig } from './integration.config';
import { crawlingConfig } from './crawling.config';
import { businessConfig } from './business.config';
import { envSchema } from './env.schema';
import { TypeConfigService } from './typed-config.service';
import { cacheConfig } from './cache.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        integrationConfig,
        crawlingConfig,
        businessConfig,
        cacheConfig,
      ],
      validationSchema: envSchema,
      validationOptions: {
        abortEarly: true, // fail-fast
      },
      cache: true, // performance
    }),
  ],
  providers: [TypeConfigService],
  exports: [TypeConfigService], // 🔥 สำคัญมาก
})
export class AppConfigModule {}

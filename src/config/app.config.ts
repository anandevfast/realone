import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.APP_PORT ?? 3000),
  timezone: process.env.APP_TZ ?? 'Asia/Bangkok',
  serverTimeout: Number(process.env.APP_SERVER_TIMEOUT ?? 600000),
}));

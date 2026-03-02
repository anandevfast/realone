import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cache } from 'cache-manager';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { Request, Response } from 'express';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const handler = context.getHandler();
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      handler,
    );

    if (!options) {
      return next.handle(); // route ไม่ได้จำกัด
    }

    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { user?: any }>();
    const res = ctx.getResponse<Response>();

    const key = this.buildKey(req, handler.name);
    const now = Date.now();

    let record = await this.cache.get<{
      count: number;
      resetAt: number;
    }>(key);

    if (!record) {
      record = {
        count: 1,
        resetAt: now + options.window * 1000,
      };

      await this.cache.set(key, record, options.window * 1000);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(options.limit - record.count, 0);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    // 🔥 ส่ง header ให้ client
    res.setHeader('X-RateLimit-Limit', options.limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > options.limit) {
      throw new HttpException(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          limit: options.limit,
          remaining,
          resetInSeconds: resetSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.cache.set(key, record, resetSeconds * 1000);

    return next.handle();
  }

  private buildKey(req: Request, routeName: string) {
    const userId = (req as any).user?.id;
    const ip = req.ip;

    return `rate_limit:${routeName}:${userId ?? ip}`;
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();

    const { method, url } = req;
    const requestId = req.requestId;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;

          this.logger.info('REQUEST_SUCCESS', {
            requestId,
            method,
            url,
            statusCode: res.statusCode, // ✅ ของจริง
            durationMs: `times: ${duration}ms`,
          });
        },
        error: (err) => {
          const duration = Date.now() - start;

          this.logger.error('REQUEST_ERROR', {
            requestId,
            method,
            url,
            statusCode: err?.status ?? res.statusCode ?? 500, // ✅ fallback
            durationMs: `times: ${duration}ms`,
            error: err?.message,
          });
        },
      }),
    );
  }
}

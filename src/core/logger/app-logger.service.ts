import { Injectable } from '@nestjs/common';
import { formatLog } from './logger.formatter';

@Injectable()
export class AppLoggerService {
  info(message: string, meta?: any) {
    console.log(formatLog('INFO', this.build(message, meta)));
  }

  warn(message: string, meta?: any) {
    console.warn(formatLog('WARN', this.build(message, meta)));
  }

  error(message: string, meta?: any) {
    console.error(formatLog('ERROR', this.build(message, meta)));
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('DEBUG', this.build(message, meta)));
    }
  }

  private build(message: string, meta?: any) {
    if (!meta) return message;
    const time = new Date().toISOString();
    const { method, url, statusCode, durationMs, error } = meta;
    return [
      message,
      `[${time}] -`,
      method && `[${method}]`,
      `'${url}' -`,
      `HTTP:[${statusCode}]`,
      error,
      durationMs && durationMs,
    ]
      .filter(Boolean)
      .join(' ');
  }
}

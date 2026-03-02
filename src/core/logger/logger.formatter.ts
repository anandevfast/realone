import chalk from 'chalk';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export function formatLog(level: LogLevel, message: string) {
  const base = `[${level}] ${message}`;

  switch (level) {
    case 'INFO':
      return chalk.green(`🟢 ${base}`);
    case 'WARN':
      return chalk.yellow(`🟡 ${base}`);
    case 'ERROR':
      return chalk.red(`🔴 ${base}`);
    case 'DEBUG':
      return chalk.blue(`🔵 ${base}`);
    default:
      return base;
  }
}

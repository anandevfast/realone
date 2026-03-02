import { registerAs } from '@nestjs/config';

export const crawlingConfig = registerAs('crawling', () => ({
  trendMonitor: process.env.CRAWL_TREND_MONITOR,
  website: process.env.CRAWL_WEBSITE,
  webboard: process.env.CRAWL_WEBBOARD,
  youtube: process.env.CRAWL_YOUTUBE,
  instagram: process.env.CRAWL_INSTAGRAM,
  pantip: process.env.CRAWL_PANTIP,
}));

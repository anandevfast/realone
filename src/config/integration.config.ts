import { registerAs } from '@nestjs/config';

export const integrationConfig = registerAs('integration', () => ({
  twitter: process.env.SERVICE_TWITTER_API,
  facebook: process.env.SERVICE_FACEBOOK_API,
  instagram: process.env.SERVICE_INSTAGRAM_API,
  youtube: process.env.SERVICE_YOUTUBE_API,
  pantip: process.env.SERVICE_PANTIP_API,
  webboard: process.env.SERVICE_WEBBOARD_API,
  website: process.env.SERVICE_WEBSITE_API,
  realmedia: process.env.SERVICE_REALMEDIA_API,
  publisher: process.env.SERVICE_PUBLISHER_API,
  crawlCenter: process.env.SERVICE_CRAWL_CENTER_API,
}));

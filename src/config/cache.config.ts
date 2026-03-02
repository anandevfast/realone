import { registerAs } from '@nestjs/config';

export const cacheConfig = registerAs('cache', () => ({
  /**
   * Default TTL in seconds for cache entries.
   */
  ttl: Number(process.env.CACHE_TTL ?? 60),

  /**
   * Maximum number of items to store in memory cache.
   */
  max: Number(process.env.CACHE_MAX ?? 1000),

  /**
   * Placeholder for Redis (or other external cache) configuration.
   * Wiring to an actual Redis store can be done later without
   * changing callers – they depend only on the normalized shape.
   */
  store: process.env.CACHE_STORE ?? 'memory',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
}));


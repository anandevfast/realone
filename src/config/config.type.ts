export interface ConfigType {
  app: ReturnType<typeof import('./app.config').appConfig>;
  auth: ReturnType<typeof import('./auth.config').authConfig>;
  cache: ReturnType<typeof import('./cache.config').cacheConfig>;
  database: ReturnType<typeof import('./database.config').databaseConfig>;
  integration: ReturnType<
    typeof import('./integration.config').integrationConfig
  >;
  crawling: ReturnType<typeof import('./crawling.config').crawlingConfig>;
  business: ReturnType<typeof import('./business.config').businessConfig>;
}

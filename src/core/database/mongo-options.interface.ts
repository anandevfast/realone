export interface MongoQueryOptions {
  hint?: Record<string, any>;
  maxTimeMS?: number;
  allowDiskUse?: boolean;
  readPreference?: string;
}

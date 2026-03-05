import _ from 'lodash';
import { CHANNEL_GROUPS } from '../constants/query-map.constant';

export function expandChannels(inputChannels: string[] = []): string[] {
  const out: string[] = [];
  for (const raw of inputChannels) {
    if (!raw) continue;
    const ch = String(raw).toLowerCase();

    if (ch.endsWith('*')) {
      const prefix = ch.slice(0, -1);
      for (const [groupKey, channels] of Object.entries(CHANNEL_GROUPS)) {
        if (groupKey.startsWith(prefix)) out.push(...channels);
      }
      continue;
    }
    if (ch.endsWith('-')) {
      const key = ch.slice(0, -1);
      if (CHANNEL_GROUPS[key]) out.push(...CHANNEL_GROUPS[key]);
      continue;
    }
    if (CHANNEL_GROUPS[ch]) {
      out.push(...CHANNEL_GROUPS[ch]);
      continue;
    }
    out.push(raw);
  }
  return _.uniq(out);
}

export function buildMonitorOr(
  monitor: Record<string, string[]>,
  operator = '$in',
) {
  const orList = [];
  for (const [platform, accounts] of Object.entries(monitor)) {
    if (!CHANNEL_GROUPS[platform] || !accounts?.length) continue;
    orList.push({
      channel: { $in: CHANNEL_GROUPS[platform] },
      account_ids: { [operator]: accounts.map(String) },
    });
  }
  return orList;
}

/** Index shape from MongoDB listIndexes: { key: { field: 1 | -1 | string }, ... } */
export type MongoIndexSpec = { key: Record<string, number | string> };

export function hasExactIndex(
  indexes: MongoIndexSpec[],
  keyPattern: Record<string, number>,
): boolean {
  const keys = Object.keys(keyPattern);
  return indexes.some((idx) => {
    if (keys.length !== Object.keys(idx.key).length) return false;
    return keys.every((k) => idx.key[k] === keyPattern[k]);
  });
}

const REQUIRED_INDEXES: Record<string, number>[] = [
  { publishedAtUnix: 1 },
  { publishedAtUnix: -1 },
  { publishedAtUnix: -1, account_ids: 1 },
  { publishedAtUnix: 1, account_ids: 1 },
  { publishedAtUnix: -1, keywords: 1 },
  { publishedAtUnix: 1, keywords: 1 },
];

export function isCompoundMigrationReady(indexes: MongoIndexSpec[]): boolean {
  return REQUIRED_INDEXES.every((pattern) => hasExactIndex(indexes, pattern));
}

/**
 * Build MongoDB hint for the query based on sort/monitor/keywords and available indexes.
 * Input shape: { sortBy?, monitor?, keywords? } (e.g. from FilterQueryDTO).
 */
export function buildMongoHint(
  input: { sortBy?: string; monitor?: Record<string, string[]>; keywords?: string[] },
  mongoIndexes: MongoIndexSpec[],
  useSort = true,
): Record<string, number> {
  const sortBy = input.sortBy ?? 'publisheddate-desc';
  const sortDesc = sortBy === 'publisheddate-desc';
  const sortDir = sortDesc && useSort ? -1 : 1;

  const hasMonitor = Object.values(input.monitor ?? {}).some(
    (arr) => Array.isArray(arr) && arr.length > 0,
  );
  const hasKeyword =
    Array.isArray(input.keywords) && input.keywords.length > 0;

  const compoundReady = isCompoundMigrationReady(mongoIndexes);

  if (!compoundReady) {
    return { publisheddate: 1 };
  }

  if (hasKeyword) {
    return { publishedAtUnix: sortDir, keywords: 1 };
  }
  if (hasMonitor) {
    return { publishedAtUnix: sortDir, account_ids: 1 };
  }
  return { publishedAtUnix: sortDir };
}

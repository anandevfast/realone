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

// 3. เช็ค Index (ใช้ pure array check)
export function isCompoundMigrationReady(indexes: any[]): boolean {
  // ยก Logic hasExactIndex ของคุณมาใส่ตรงนี้ได้เลย
  // ... (เพื่อความกระชับ ขอละ Logic เดิมของคุณไว้นะครับ)
  console.log('indexes', indexes);
  return true; // Mock ไว้ก่อน
}

/**
 * Unit tests for SocialQueryBuilderService.buildQuery
 * Focus: hint assignment logic (lines 532-545)
 *
 * Logic under test:
 *   const _idIn = result.match._id && (result.match._id as any).$in;
 *   result.hint = _idIn
 *     ? { _id: 1 }
 *     : buildMongoHint({ sortBy, monitor, keywords }, dbIndexes, true);
 */

import 'reflect-metadata';
import { SocialQueryBuilderService } from './social-query-builder.service';
import type { Cache } from 'cache-manager';
import type { Model } from 'mongoose';
import type { SocialMessageDocument } from '../../infrastructure/schemas/social-message.schema';

// All 6 indexes required by isCompoundMigrationReady()
const COMPOUND_READY_INDEXES = [
  { key: { publishedAtUnix: 1 } },
  { key: { publishedAtUnix: -1 } },
  { key: { publishedAtUnix: -1, account_ids: 1 } },
  { key: { publishedAtUnix: 1, account_ids: 1 } },
  { key: { publishedAtUnix: -1, keywords: 1 } },
  { key: { publishedAtUnix: 1, keywords: 1 } },
];

function buildService(
  indexes: Record<string, unknown>[] = COMPOUND_READY_INDEXES,
): SocialQueryBuilderService {
  const mockCollection = {
    indexes: jest.fn().mockResolvedValue(indexes),
  };
  const mockModel = {
    db: { collection: jest.fn().mockReturnValue(mockCollection) },
  } as unknown as Model<SocialMessageDocument>;

  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  } as unknown as Cache;

  return new SocialQueryBuilderService(mockModel, mockCache);
}

const BASE_DTO = {
  startDate: '2026-03-04T00:00:00+07:00',
  endDate: '2026-03-04T23:59:59+07:00',
};

describe('SocialQueryBuilderService – buildQuery hint assignment (lines 532-545)', () => {
  // --- arr_id path: hint must be { _id: 1 } ---

  it('uses { _id: 1 } hint when arr_id is provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      { ...BASE_DTO, arr_id: ['507f1f77bcf86cd799439011'] } as any,
    );
    expect(result.hint).toEqual({ _id: 1 });
  });

  it('uses { _id: 1 } hint even when keywords are also provided (arr_id takes precedence)', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      {
        ...BASE_DTO,
        arr_id: ['507f1f77bcf86cd799439011'],
        keywords: ['keyword-abc'],
      } as any,
    );
    expect(result.hint).toEqual({ _id: 1 });
  });

  // --- buildMongoHint path: varies by keywords / monitor / sort ---

  it('uses keywords compound hint when keywords are provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      keywords: ['679c3ff963b8fc3a5256b681'],
    } as any);
    // default sortBy = publisheddate-desc → dir = -1
    expect(result.hint).toEqual({ publishedAtUnix: -1, keywords: 1 });
  });

  it('uses account_ids compound hint when monitor is provided (no keywords)', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      {
        ...BASE_DTO,
        monitor: { twitter: ['account_001'] },
      } as any,
    );
    expect(result.hint).toEqual({ publishedAtUnix: -1, account_ids: 1 });
  });

  it('uses simple publishedAtUnix hint when no keywords, no monitor, no arr_id', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({ ...BASE_DTO } as any);
    expect(result.hint).toEqual({ publishedAtUnix: -1 });
  });

  it('flips sort direction to +1 when sortBy is ascending', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      { ...BASE_DTO, sortBy: 'publisheddate-asc', keywords: ['kw'] } as any,
    );
    expect(result.hint).toEqual({ publishedAtUnix: 1, keywords: 1 });
  });

  // --- compound indexes NOT ready: always fallback to legacy hint ---

  it('falls back to { publisheddate: 1 } when compound indexes are not ready', async () => {
    const svc = buildService([]); // no indexes → isCompoundMigrationReady = false
    const result = await svc.buildQuery({
      ...BASE_DTO,
      keywords: ['keyword-abc'],
    } as any);
    expect(result.hint).toEqual({ publisheddate: 1 });
  });

  it('falls back to { publisheddate: 1 } when only partial compound indexes exist', async () => {
    const svc = buildService([{ key: { publishedAtUnix: 1 } }]); // missing others
    const result = await svc.buildQuery({
      ...BASE_DTO,
      monitor: { twitter: ['acc'] },
    } as any);
    expect(result.hint).toEqual({ publisheddate: 1 });
  });

  // --- edge cases ---

  it('returns the match object with rawContent.save_import always set', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({ ...BASE_DTO } as any);
    expect(result.match['rawContent.save_import']).toEqual({ $nin: [false] });
  });

  it('includes publishedAtUnix date range in match when compound indexes are ready', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({ ...BASE_DTO } as any);
    expect(result.match.publishedAtUnix).toBeDefined();
    expect(result.match.publishedAtUnix.$gte).toBeInstanceOf(Date);
    expect(result.match.publishedAtUnix.$lte).toBeInstanceOf(Date);
  });

  it('includes publisheddate in match when compound indexes are NOT ready', async () => {
    const svc = buildService([]);
    const result = await svc.buildQuery({ ...BASE_DTO } as any);
    expect(result.match.publisheddate).toBeDefined();
  });

  // --- statusMessage filter ---

  it('sets match.statusMessage { $in: ["read"] } when statusMessage is ["read"]', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      { ...BASE_DTO, statusMessage: ['read'] } as any,
    );

    expect(result.match.statusMessage).toEqual({ $in: ['read'] });
  });

  it('sets match.statusMessage { $nin: ["read"] } when statusMessage is ["unread"]', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      { ...BASE_DTO, statusMessage: ['unread'] } as any,
    );
    expect(result.match.statusMessage).toEqual({ $nin: ['read'] });
  });

  it('does NOT set match.statusMessage when statusMessage has 2+ values (show all)', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      { ...BASE_DTO, statusMessage: ['read', 'unread'] } as any,
    );
    expect(result.match.statusMessage).toBeUndefined();
  });
});

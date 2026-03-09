/**
 * Unit tests for SocialQueryBuilderService.buildQuery
 * Coverage aligned with FilterQueryDTO: startDate, endDate, email, channel, keywords,
 * tags, metric, sortBy, condition, sentiment, statusMessage, visibility, resultBy,
 * favoriteMessage, postFormat, intent, speakerType, trackingPost, filterBy, language,
 * detectedBy, advanceSearch; plus code, arr_id, ex_tags, monitor (and hint logic).
 */

import 'reflect-metadata';
import { SocialQueryBuilderService } from './social-query-builder.service';
import type { Cache } from 'cache-manager';
import type { Model } from 'mongoose';
import type { SocialMessageDocument } from '../../infrastructure/schemas/social-message.schema';

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

describe('SocialQueryBuilderService – buildQuery (FilterQueryDTO coverage)', () => {
  // ---------- Date range (startDate, endDate) ----------
  it('sets publishedAtUnix date range when compound indexes ready', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({ ...BASE_DTO } as any);
    expect(result.match.publishedAtUnix).toBeDefined();
    expect(result.match.publishedAtUnix.$gte).toBeInstanceOf(Date);
    expect(result.match.publishedAtUnix.$lte).toBeInstanceOf(Date);
  });

  it('sets publisheddate date range when compound indexes NOT ready', async () => {
    const svc = buildService([]);
    const result = await svc.buildQuery({ ...BASE_DTO } as any);
    expect(result.match.publisheddate).toBeDefined();
  });

  // ---------- Sort (sortBy) ----------
  it('default sort is publishedAtUnix -1', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({ ...BASE_DTO } as any);
    expect(result.sort).toEqual({ publishedAtUnix: -1 });
  });

  it('sortBy publisheddate-asc sets sort publishedAtUnix 1', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      sortBy: 'publisheddate-asc',
    } as any);
    expect(result.sort).toEqual({ publishedAtUnix: 1 });
  });

  it('sortBy totalEngagement-desc sets sort totalEngagement -1', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      sortBy: 'totalEngagement-desc',
    } as any);
    expect(result.sort).toEqual({ totalEngagement: -1 });
  });

  it('sortBy totalView-asc sets sort totalView 1', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      sortBy: 'totalView-asc',
    } as any);
    expect(result.sort).toEqual({ totalView: 1 });
  });

  it('sortBy follower-desc sets sort follower -1', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      sortBy: 'follower-desc',
    } as any);
    expect(result.sort).toEqual({ follower: -1 });
  });

  // ---------- Code ----------
  it('sets match.code $regex when code array provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      code: ['code-a', 'code-b'],
    } as any);
    expect(result.match.code).toEqual({ $regex: 'code-a|code-b' });
  });

  // ---------- Channel ----------
  it('sets match.channel $in expanded channels when channel provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      channel: ['twitter'],
    } as any);
    expect(result.match.channel).toEqual({
      $in: [
        'twitter-tweet',
        'twitter-reply',
        'twitter-retweet',
        'twitter-quote',
      ],
    });
  });

  it('sets match.channel for single literal channel', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      channel: ['pantip'],
    } as any);
    expect(result.match.channel).toBeDefined();
    expect(result.match.channel.$in).toContain('pantip-post');
  });

  // ---------- Keywords (no monitor) ----------
  it('sets match.$or with keywords $in when keywords only and condition or', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      keywords: ['kw1', 'kw2'],
    } as any);
    expect(result.match.$or).toBeDefined();
    expect(result.match.$or).toContainEqual({
      keywords: { $in: ['kw1', 'kw2'] },
    });
  });

  it('sets match.$and with keywords when keywords only and condition and', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      keywords: ['kw1'],
      condition: 'and' as any,
    } as any);
    expect(result.match.$and).toBeDefined();
    expect(result.match.$and).toContainEqual({
      keywords: { $in: ['kw1'] },
    });
  });

  it('keyword "No Keyword" sets keywords $in to empty array', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      keywords: ['No Keyword'],
    } as any);
    expect(result.match.$or).toContainEqual({ keywords: { $in: [] } });
  });

  // ---------- Tags & ex_tags ----------
  it('sets match.tags $in when tags provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      tags: ['tag-a', 'tag-b'],
    } as any);
    expect(result.match.tags).toEqual({ $in: ['tag-a', 'tag-b'] });
  });

  it('sets match.tags $nin when ex_tags provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      ex_tags: ['ex1', 'ex2'],
    } as any);
    expect(result.match.tags).toEqual({ $nin: ['ex1', 'ex2'] });
  });

  it('combines tags $in and $nin when both tags and ex_tags provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      tags: ['allowed'],
      ex_tags: ['excluded'],
    } as any);
    expect(result.match.tags).toMatchObject({
      $in: ['allowed'],
      $nin: ['excluded'],
    });
  });

  // ---------- SIMPLE_IN_FIELDS: sentiment (content.sentiment), speakerType, intent ----------
  it('sets match["content.sentiment"] $in when sentiment provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      sentiment: ['positive', 'negative'],
    } as any);
    expect(result.match['content.sentiment']).toEqual({
      $in: ['positive', 'negative'],
    });
  });

  it('sets match.speakerType $in when speakerType provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      speakerType: ['brand', 'influencer'],
    } as any);
    expect(result.match.speakerType).toEqual({
      $in: ['brand', 'influencer'],
    });
  });

  it('maps speakerType "none" to empty string', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      speakerType: ['none', 'brand'],
    } as any);
    expect(result.match.speakerType.$in).toContain('');
    expect(result.match.speakerType.$in).toContain('brand');
  });

  it('sets match.intent $in when intent provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      intent: ['information', 'complaint'],
    } as any);
    expect(result.match.intent).toEqual({
      $in: ['information', 'complaint'],
    });
  });

  it('maps intent "none" to empty string', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      intent: ['none'],
    } as any);
    expect(result.match.intent.$in).toEqual(['']);
  });

  // ---------- filterBy (sendTo.alert) ----------
  it('sets match["sendTo.alert"] $in when filterBy provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      filterBy: ['alert-1', 'alert-2'],
    } as any);
    expect(result.match['sendTo.alert']).toEqual({
      $in: ['alert-1', 'alert-2'],
    });
  });

  // ---------- postFormat ----------
  it('sets match.postFormat to array when postFormat is ["text"]', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      postFormat: ['text'],
    } as any);
    expect(result.match.postFormat).toEqual(['text']);
  });

  it('sets match.postFormat $in and adds album when image present', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      postFormat: ['image', 'video'],
    } as any);
    expect(result.match.postFormat.$in).toContain('image');
    expect(result.match.postFormat.$in).toContain('video');
    expect(result.match.postFormat.$in).toContain('album');
  });

  // ---------- trackingPost ----------
  it('sets match.trackingPost $gt when trackingPost includes activeTracking', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      trackingPost: ['activeTracking'],
    } as any);
    expect(result.match.trackingPost).toBeDefined();
    expect(result.match.trackingPost.$gt).toBeDefined();
  });

  it('sets match.trackingPost $lt when trackingPost is stoppedTracking', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      trackingPost: ['stoppedTracking'],
    } as any);
    expect(result.match.trackingPost).toBeDefined();
    expect(result.match.trackingPost.$lt).toBeDefined();
  });

  // ---------- statusMessage ----------
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

  it('does NOT set match.statusMessage when statusMessage length >= 2', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      { ...BASE_DTO, statusMessage: ['read', 'unread'] } as any,
    );
    expect(result.match.statusMessage).toBeUndefined();
  });

  // ---------- visibility ----------
  it('sets match.visibility { $in: ["hide"] } when visibility includes hide', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      visibility: ['hide'],
    } as any);
    expect(result.match.visibility).toEqual({ $in: ['hide'] });
  });

  it('sets match.visibility { $nin: ["hide"] } when visibility is show only', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      visibility: ['show'],
    } as any);
    expect(result.match.visibility).toEqual({ $nin: ['hide'] });
  });

  it('does NOT set match.visibility when visibility length >= 2', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      visibility: ['hide', 'show'],
    } as any);
    expect(result.match.visibility).toBeUndefined();
  });

  // ---------- detectedBy (ai_detect) ----------
  it('adds $and with ai_detect $in when detectedBy provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      detectedBy: ['logo', 'ocr'],
    } as any);
    expect(result.match.$and).toBeDefined();
    const orDetect = result.match.$and.find(
      (c: any) => c?.$or?.[0]?.['ai_detect'],
    );
    expect(orDetect).toBeDefined();
    expect(orDetect.$or[0]['ai_detect'].$in).toEqual(['logo', 'ocr']);
  });

  // ---------- language ----------
  it('adds $and with $or of language regex when language provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      language: ['th', 'en'],
    } as any);
    expect(result.match.$and).toBeDefined();
    const langOr = result.match.$and.find(
      (c: any) =>
        Array.isArray(c?.$or) &&
        c.$or.some((x: any) => x && Object.keys(x).some((k) => x[k]?.$regex)),
    );
    expect(langOr).toBeDefined();
  });

  // ---------- arr_id ----------
  it('sets match._id $in ObjectIds when arr_id provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      { ...BASE_DTO, arr_id: ['507f1f77bcf86cd799439011'] } as any,
    );
    expect(result.match._id).toBeDefined();
    expect(result.match._id.$in).toHaveLength(1);
    expect(String(result.match._id.$in[0])).toBe('507f1f77bcf86cd799439011');
  });

  // ---------- Monitor + condition ----------
  it('sets match.$or with monitor and keywords when monitor provided and condition or', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      monitor: { twitter: ['acc1'] },
      keywords: ['kw1'],
    } as any);
    expect(result.match.$or).toBeDefined();
    expect(result.match.$or.some((c: any) => c.keywords)).toBe(true);
    expect(result.match.$or.some((c: any) => c.$or)).toBe(true);
  });

  it('sets match.$and with keyword and $nor monitor when condition keywordAndNotMonitor', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      monitor: { twitter: ['acc1'] },
      keywords: ['kw1'],
      condition: 'keywordAndNotMonitor' as any,
    } as any);
    expect(result.match.$and).toBeDefined();
    expect(result.match.$and.some((c: any) => c.$nor)).toBe(true);
  });

  // ---------- Hint logic ----------
  it('uses { _id: 1 } hint when arr_id is provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      { ...BASE_DTO, arr_id: ['507f1f77bcf86cd799439011'] } as any,
    );
    expect(result.hint).toEqual({ _id: 1 });
  });

  it('uses keywords compound hint when keywords provided and compound ready', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      keywords: ['679c3ff963b8fc3a5256b681'],
    } as any);
    expect(result.hint).toEqual({ publishedAtUnix: -1, keywords: 1 });
  });

  it('uses account_ids compound hint when monitor provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      monitor: { twitter: ['account_001'] },
    } as any);
    expect(result.hint).toEqual({ publishedAtUnix: -1, account_ids: 1 });
  });

  it('falls back to { publisheddate: 1 } when compound indexes not ready', async () => {
    const svc = buildService([]);
    const result = await svc.buildQuery({
      ...BASE_DTO,
      keywords: ['kw'],
    } as any);
    expect(result.hint).toEqual({ publisheddate: 1 });
  });

  // ---------- Always present ----------
  it('always sets match["rawContent.save_import"] { $nin: [false] }', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({ ...BASE_DTO } as any);
    expect(result.match['rawContent.save_import']).toEqual({ $nin: [false] });
  });

  // ---------- favoriteMessage (no user fav data => no _id filter) ----------
  it('does not set match._id for favorite when email provided but user has no favorites', async () => {
    const svc = buildService();
    const result = await svc.buildQuery(
      {
        ...BASE_DTO,
        email: 'user@test.com',
        favoriteMessage: ['favorite'],
      } as any,
    );
    expect(result.match._id).toBeUndefined();
  });

  // ---------- advanceSearch (smoke: adds advanceSearchFields when word include) ----------
  it('adds advanceSearchFields when advanceSearch.word.include provided', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      advanceSearch: {
        word: { include: ['test'], exclude: [] },
      },
    } as any);
    expect(result.advanceSearchFields).toBeDefined();
    expect(result.advanceSearchFields?.$addFields).toBeDefined();
  });

  it('adds match.advanceSearchWord when advanceSearch word include/exclude', async () => {
    const svc = buildService();
    const result = await svc.buildQuery({
      ...BASE_DTO,
      advanceSearch: {
        word: { include: ['hello'], exclude: ['spam'] },
      },
    } as any);
    expect(result.match.advanceSearchWord).toBeDefined();
    expect(result.match.advanceSearchWord.$regex).toBeDefined();
  });
});

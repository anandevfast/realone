import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import _ from 'lodash';
import { InfluencerService } from './influencer.service';
import { InfluencerRepository } from '../../infrastructure/repositories/influencer.repository';
import { InfluencerFilterDTO } from './dto/influencer-filter.dto';

function buildService(mockData: {
  grouped?: any[];
  topInfluencer?: any[];
  throwOn?: 'grouped' | 'top';
}) {
  const repo = {
    getGroupedData: jest.fn().mockImplementation(async () => {
      if (mockData.throwOn === 'grouped') {
        throw new Error('grouped-failed');
      }
      return mockData.grouped ?? [];
    }),
    getTopInfluencer: jest.fn().mockImplementation(async () => {
      if (mockData.throwOn === 'top') {
        throw new Error('top-failed');
      }
      const rows = mockData.topInfluencer ?? [];
      return { current: rows, compare: null };
    }),
  } as unknown as InfluencerRepository;

  return new InfluencerService(repo);
}

const BASE_DTO: Partial<InfluencerFilterDTO> = {
  startDate: '2026-03-04T00:00:00+07:00',
  endDate: '2026-03-04T23:59:59+07:00',
  condition: 'or' as any,
  email: 'test@example.com',
};

describe('InfluencerService – buildTopInfluencer summary', () => {
  it('computes uniqueAuthor, uniqueSite, averages and values for normal data', () => {
    const svc = buildService({ grouped: [], topInfluencer: [] });
    const raw = [
      {
        _id: 'author-1',
        domain: 'https://site-a.com',
        post: 2,
        engagement: 100,
        follower: 10,
      },
      {
        _id: 'author-2',
        domain: 'https://site-b.com',
        post: 3,
        engagement: 50,
        follower: 5,
      },
      {
        _id: 'author-3',
        domain: 'https://site-a.com',
        post: 5,
        engagement: 20,
        follower: 1,
      },
    ];

    const summary = (svc as any).buildTopInfluencer(raw);

    expect(summary.uniqueAuthor).toBe(3);
    expect(summary.uniqueSite).toBe(2);
    const totalPost = 2 + 3 + 5;
    expect(summary.averageMentionAuthor).toBe(
      _.round(totalPost / 3, 2),
    );
    expect(summary.averageMentionSite).toBe(
      _.round(totalPost / 2, 2),
    );
    expect(summary.values).toHaveLength(3);
    // top value should be author with highest engagement/follower/post
    expect(summary.values[0]._id).toBe('author-1');
  });

  it('excludes _id === "null" from uniqueAuthor and values', () => {
    const svc = buildService({ grouped: [], topInfluencer: [] });
    const raw = [
      { _id: 'author-1', domain: 'https://a.com', post: 1, engagement: 10 },
      { _id: 'null', domain: 'https://b.com', post: 2, engagement: 5 },
    ];

    const summary = (svc as any).buildTopInfluencer(raw);

    expect(summary.uniqueAuthor).toBe(1);
    expect(summary.values).toHaveLength(1);
    expect(summary.values[0]._id).toBe('author-1');
  });

  it('handles empty input without NaN averages', () => {
    const svc = buildService({ grouped: [], topInfluencer: [] });
    const summary = (svc as any).buildTopInfluencer([]);

    expect(summary.uniqueAuthor).toBe(0);
    expect(summary.uniqueSite).toBe(0);
    expect(summary.averageMentionAuthor).toBe(0);
    expect(summary.averageMentionSite).toBe(0);
    expect(summary.values).toEqual([]);
  });

  it('limits values array to 100 items and keeps highest engagement first', () => {
    const svc = buildService({ grouped: [], topInfluencer: [] });
    const raw = Array.from({ length: 120 }).map((_, idx) => ({
      _id: `author-${idx}`,
      domain: `https://site-${idx % 3}.com`,
      post: 1,
      engagement: idx, // increasing
      follower: 0,
    }));

    const summary = (svc as any).buildTopInfluencer(raw);

    expect(summary.values).toHaveLength(100);
    // highest engagement should be first
    expect(summary.values[0].engagement).toBe(
      Math.max(...raw.map((r) => r.engagement)),
    );
  });

  it('adds previousFollower, percentFollower, changeFollower when compareRaw is provided', () => {
    const svc = buildService({ grouped: [], topInfluencer: [] });
    const raw = [
      { _id: 'a1', domain: 'd1', post: 2, engagement: 10, follower: 200 },
      { _id: 'a2', domain: 'd2', post: 1, engagement: 5, follower: 50 },
    ];
    const compareRaw = [
      { _id: 'a1', domain: 'd1', post: 1, engagement: 5, follower: 100 },
      { _id: 'a2', domain: 'd2', post: 1, engagement: 5, follower: 100 },
    ];

    const summary = (svc as any).buildTopInfluencer(raw, compareRaw);

    expect(summary.values).toHaveLength(2);
    const v1 = summary.values.find((v: any) => v._id === 'a1');
    const v2 = summary.values.find((v: any) => v._id === 'a2');
    expect(v1.previousFollower).toBe(100);
    expect(v1.percentFollower).toBe(100); // |200-100|/100 * 100
    expect(v1.changeFollower).toBe('up');
    expect(v2.previousFollower).toBe(100);
    expect(v2.percentFollower).toBe(50); // |50-100|/100 * 100
    expect(v2.changeFollower).toBe('down');
  });
});

describe('InfluencerService – query()', () => {
  it('returns all charts + topInfluencer summary when chartName is not provided', async () => {
    const grouped: any[] = [];
    const topInfluencerRaw = [
      {
        _id: 'author-1',
        domain: 'https://a.com',
        post: 2,
        engagement: 10,
        follower: 1,
      },
    ];
    const svc = buildService({ grouped, topInfluencer: topInfluencerRaw });

    const result = await svc.query(BASE_DTO as InfluencerFilterDTO);

    expect(result.topInfluencer).toBeDefined();
    expect(result.topInfluencer.uniqueAuthor).toBe(1);
    expect(result.topInfluencer.values).toHaveLength(1);

    // a few representative charts should exist
    expect(result.uniqueAuthorsByKeyword).toBeDefined();
    expect(result.uniqueSitesByChannel).toBeDefined();
    expect(result.uniqueAuthorsByTags).toBeDefined();
  });

  it('returns single chart + topInfluencer when chartName is provided', async () => {
    const grouped: any[] = [];
    const topInfluencerRaw = [
      {
        _id: 'author-1',
        domain: 'https://a.com',
        post: 1,
        engagement: 5,
        follower: 0,
      },
    ];
    const svc = buildService({ grouped, topInfluencer: topInfluencerRaw });

    const dto = {
      ...BASE_DTO,
      chartName: 'UniqueAuthorsTopic',
    } as InfluencerFilterDTO;

    const result = await svc.query(dto);

    expect(result.topInfluencer).toBeDefined();
    expect(result.topInfluencer.values).toHaveLength(1);
    expect(result.uniqueAuthorsByKeyword).toBeDefined();

    // should not include charts that belong to processAllCharts only
    expect(result.uniqueSitesByChannel).toBeUndefined();
  });

  it('wraps repository errors in BadRequestException', async () => {
    const svc = buildService({
      grouped: [],
      topInfluencer: [],
      throwOn: 'grouped',
    });

    await expect(
      svc.query(BASE_DTO as InfluencerFilterDTO),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
}
)
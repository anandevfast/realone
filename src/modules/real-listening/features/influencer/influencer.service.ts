import { BadRequestException, Injectable } from '@nestjs/common';
import _ from 'lodash';

import {
  InfluencerRepository,
  InfluencerRawResult,
} from '../../infrastructure/repositories/influencer.repository';
import { InfluencerFilterDTO } from './dto/influencer-filter.dto';
import {
  getChannelsFromData,
  getTagsFromData,
  lookupKeywordName,
  clearEmptySeriesData,
} from '../../common/utils/aggregation.util';

@Injectable()
export class InfluencerService {
  constructor(private readonly influencerRepository: InfluencerRepository) {}

  async query(dto: InfluencerFilterDTO) {
    try {
      const [grouped, topInfluencer] = await Promise.all([
        this.influencerRepository.getGroupedData(dto),
        this.influencerRepository.getTopInfluencer(dto),
      ]);

      if (dto.chartName) {
        return {
          ...this.processChart(dto.chartName, grouped, dto),
          topInfluencer,
        };
      }

      return {
        ...this.processAllCharts(grouped, dto),
        topInfluencer,
      };
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }

  private processChart(
    chartName: string,
    grouped: InfluencerRawResult[],
    dto: InfluencerFilterDTO,
  ): any {
    const keywordNameMaps: any[] = [];

    switch (chartName) {
      case 'UniqueAuthorsTopic':
        return { uniqueAuthorsByKeyword: uniqueAuthorsByKeywordChart(grouped, dto, keywordNameMaps) };
      case 'UniqueSitesTopic':
        return { uniqueSitesByKeyword: uniqueSitesByKeywordChart(grouped, dto, keywordNameMaps) };
      case 'UniqueAuthorsChannel':
        return { uniqueAuthorsByChannel: uniqueAuthorsByChannelChart(grouped, dto) };
      case 'UniqueSitesChannel':
        return { uniqueSitesByChannel: uniqueSitesByChannelChart(grouped, dto) };
      case 'UniqueAuthorsSentiment':
        return { uniqueAuthorsBySentiment: uniqueAuthorsBySentimentChart(grouped, dto) };
      case 'UniqueSitesSentiment':
        return { uniqueSitesBySentiment: uniqueSitesBySentimentChart(grouped, dto) };
      case 'UniqueAuthorsCategory':
        return { uniqueAuthorsByCategory: uniqueAuthorsByCategoryChart(grouped, dto) };
      case 'UniqueSitesCategory':
        return { uniqueSitesByCategory: uniqueSitesByCategoryChart(grouped, dto) };
      case 'UniqueAuthorsTags':
        return { uniqueAuthorsByTags: uniqueAuthorsByTagsChart(grouped, dto) };
      case 'UniqueSitesTags':
        return { uniqueSitesByTags: uniqueSitesByTagsChart(grouped, dto) };
      default:
        return {};
    }
  }

  private processAllCharts(
    grouped: InfluencerRawResult[],
    dto: InfluencerFilterDTO,
  ): any {
    const keywordNameMaps: any[] = [];
    return {
      uniqueAuthorsByKeyword: uniqueAuthorsByKeywordChart(grouped, dto, keywordNameMaps),
      uniqueSitesByKeyword: uniqueSitesByKeywordChart(grouped, dto, keywordNameMaps),
      uniqueAuthorsByChannel: uniqueAuthorsByChannelChart(grouped, dto),
      uniqueSitesByChannel: uniqueSitesByChannelChart(grouped, dto),
      uniqueAuthorsBySentiment: uniqueAuthorsBySentimentChart(grouped, dto),
      uniqueSitesBySentiment: uniqueSitesBySentimentChart(grouped, dto),
      uniqueAuthorsByCategory: uniqueAuthorsByCategoryChart(grouped, dto),
      uniqueSitesByCategory: uniqueSitesByCategoryChart(grouped, dto),
      uniqueAuthorsByTags: uniqueAuthorsByTagsChart(grouped, dto),
      uniqueSitesByTags: uniqueSitesByTagsChart(grouped, dto),
    };
  }
}

/* =====================================================================
 * Influencer Chart Processing Functions (pure, testable)
 * ===================================================================== */

function getKeywordsFromInfluencer(results: InfluencerRawResult[], dto: InfluencerFilterDTO): string[] {
  const allKeywords = [
    ...new Set<string>(
      ([] as string[]).concat(...results.map((r) => r._id.keywords ?? [])),
    ),
  ];
  const keywords = dto.keywords?.length ? dto.keywords : allKeywords;
  return keywords.sort();
}

export function uniqueAuthorsByKeywordChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
  keywordNameMaps: any[],
): any {
  const keywords = getKeywordsFromInfluencer(results, dto);
  const xAxis = {
    categories: keywords.map((k) => lookupKeywordName(k, keywordNameMaps)),
    categories2: keywords,
  };
  const series = [
    {
      name: 'Number of Authors',
      data: keywords.map((keyword) => {
        const names = results
          .filter((r) => r._id.keywords?.includes(keyword))
          .flatMap((r) => r.arr_name);
        return [...new Set(names)].length;
      }),
    },
  ];
  const result = { xAxis, series };
  return dto.keywords?.length ? result : clearEmptySeriesData(result);
}

export function uniqueSitesByKeywordChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
  keywordNameMaps: any[],
): any {
  const keywords = getKeywordsFromInfluencer(results, dto);
  const xAxis = {
    categories: keywords.map((k) => lookupKeywordName(k, keywordNameMaps)),
    categories2: keywords,
  };
  const series = [
    {
      name: 'Number of Sites',
      data: keywords.map((keyword) => {
        const domains = results
          .filter((r) => r._id.keywords?.includes(keyword))
          .flatMap((r) => r.arr_domain);
        return [...new Set(domains)].length;
      }),
    },
  ];
  const result = { xAxis, series };
  return dto.keywords?.length ? result : clearEmptySeriesData(result);
}

export function uniqueAuthorsByChannelChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
): any {
  const channels = dto.channel?.length
    ? dto.channel.map((c) => c.replace(/\*$/, ''))
    : [
        ...new Set<string>(
          results.map((r) => r._id.channel?.split('-')[0]).filter(Boolean),
        ),
      ];

  const series = [
    {
      name: 'channels',
      colorByPoint: true,
      data: channels.map((channel) => {
        const names = results
          .filter((r) => r._id.channel?.includes(channel))
          .flatMap((r) => r.arr_name);
        return { name: channel, y: [...new Set(names)].length };
      }),
    },
  ];
  return { xAxis: { type: 'category' }, series };
}

export function uniqueSitesByChannelChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
): any {
  const channels = dto.channel?.length
    ? dto.channel.map((c) => c.replace(/\*$/, ''))
    : [
        ...new Set<string>(
          results.map((r) => r._id.channel?.split('-')[0]).filter(Boolean),
        ),
      ];

  const series = [
    {
      name: 'channels',
      colorByPoint: true,
      data: channels.map((channel) => {
        const domains = results
          .filter((r) => r._id.channel?.includes(channel))
          .flatMap((r) => r.arr_domain);
        return { name: channel, y: [...new Set(domains)].length };
      }),
    },
  ];
  return { xAxis: { type: 'category' }, series };
}

export function uniqueAuthorsBySentimentChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
): any {
  const ALL_SENTIMENTS = ['positive', 'neutral', 'negative'];
  const series = [
    {
      name: 'sentiment',
      colorByPoint: true,
      data: ALL_SENTIMENTS.map((sentiment) => {
        const names = results
          .filter((r) => r._id.sentiment === sentiment)
          .flatMap((r) => r.arr_name);
        return { name: sentiment, y: [...new Set(names)].length };
      }),
    },
  ];
  return { xAxis: { type: 'category' }, series };
}

export function uniqueSitesBySentimentChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
): any {
  const ALL_SENTIMENTS = ['positive', 'neutral', 'negative'];
  const series = [
    {
      name: 'sentiment',
      colorByPoint: true,
      data: ALL_SENTIMENTS.map((sentiment) => {
        const domains = results
          .filter((r) => r._id.sentiment === sentiment)
          .flatMap((r) => r.arr_domain);
        return { name: sentiment, y: [...new Set(domains)].length };
      }),
    },
  ];
  return { xAxis: { type: 'category' }, series };
}

export function uniqueAuthorsByCategoryChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
): any {
  const allTags = [
    ...new Set<string>(([] as string[]).concat(...results.map((r) => (r._id as any).keyword_tag ?? []))),
  ];
  const categories = [...new Set(allTags.map((t) => t?.split('_')[0]).filter(Boolean))].sort();

  const series = [
    {
      name: 'categories',
      colorByPoint: true,
      data: categories.map((cat) => {
        const names = results
          .filter((r) => (r._id as any).keyword_tag?.some((t: string) => t?.startsWith(cat)))
          .flatMap((r) => r.arr_name);
        return { name: cat, y: [...new Set(names)].length };
      }),
    },
  ];
  return { xAxis: { type: 'category' }, series };
}

export function uniqueSitesByCategoryChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
): any {
  const allTags = [
    ...new Set<string>(([] as string[]).concat(...results.map((r) => (r._id as any).keyword_tag ?? []))),
  ];
  const categories = [...new Set(allTags.map((t) => t?.split('_')[0]).filter(Boolean))].sort();

  const series = [
    {
      name: 'categories',
      colorByPoint: true,
      data: categories.map((cat) => {
        const domains = results
          .filter((r) => (r._id as any).keyword_tag?.some((t: string) => t?.startsWith(cat)))
          .flatMap((r) => r.arr_domain);
        return { name: cat, y: [...new Set(domains)].length };
      }),
    },
  ];
  return { xAxis: { type: 'category' }, series };
}

export function uniqueAuthorsByTagsChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
): any {
  const allTags = [
    ...new Set<string>(
      ([] as string[]).concat(...results.map((r) => (r._id as any).keyword_tag ?? [])),
    ),
  ];
  const tags = dto.tags?.length ? dto.tags as string[] : allTags.sort();

  const xAxis = { categories: tags, categories2: tags };
  const series = [
    {
      name: 'Number of Authors',
      data: tags.map((tag) => {
        const names = results
          .filter((r) => (r._id as any).keyword_tag?.includes(tag))
          .flatMap((r) => r.arr_name);
        return [...new Set(names)].length;
      }),
    },
  ];
  return { xAxis, series };
}

export function uniqueSitesByTagsChart(
  results: InfluencerRawResult[],
  dto: InfluencerFilterDTO,
): any {
  const allTags = [
    ...new Set<string>(
      ([] as string[]).concat(...results.map((r) => (r._id as any).keyword_tag ?? [])),
    ),
  ];
  const tags = dto.tags?.length ? dto.tags as string[] : allTags.sort();

  const xAxis = { categories: tags, categories2: tags };
  const series = [
    {
      name: 'Number of Sites',
      data: tags.map((tag) => {
        const domains = results
          .filter((r) => (r._id as any).keyword_tag?.includes(tag))
          .flatMap((r) => r.arr_domain);
        return [...new Set(domains)].length;
      }),
    },
  ];
  return { xAxis, series };
}

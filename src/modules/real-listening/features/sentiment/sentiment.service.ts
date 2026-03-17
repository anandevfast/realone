import { BadRequestException, Injectable } from '@nestjs/common';
import _ from 'lodash';
import dayjs from 'dayjs';

import { SentimentRepository } from '../../infrastructure/repositories/sentiment.repository';
import { SentimentFilterDTO } from './dto/sentiment-filter.dto';
import { TimeSeriesResult } from '../../infrastructure/repositories/analytics.repository';
import {
  flattenSeriesData,
  getKeywordsFromData,
  getChannelsFromData,
  getTagsFromData,
  lookupKeywordName,
} from '../../common/utils/aggregation.util';
import { Sentiment } from '../../domain/social-enum';

@Injectable()
export class SentimentService {
  constructor(private readonly sentimentRepository: SentimentRepository) {}

  private static readonly changeConvert = (
    v: number,
  ): 'up' | 'down' | 'nothing' =>
    Number.isFinite(v)
      ? v > 0
        ? 'up'
        : v < 0
          ? 'down'
          : 'nothing'
      : 'nothing';

  /**
   * Wrap a flat values array (items with `y` key) with compare stats.
   * Returns { previous, current, percent, change, values } when compare data exists,
   * or { current, percent, values } when no compare.
   *
   * percentMode:
   *   'ratio'  (default) – percent = current / base
   *   'change'           – percent = (current - previous) / previous
   */
  private wrapWithCompare(
    currentValues: any[],
    compareValues: any[] | null,
    sumKey: string = 'y',
    percentMode: 'ratio' | 'change' = 'ratio',
  ): any {
    const current = _.sumBy(currentValues, sumKey);

    if (!compareValues) {
      return {
        current,
        percent: current > 0 ? _.floor(current / current, 4) : 0,
        values: currentValues,
      };
    }

    const previous = _.sumBy(compareValues, sumKey);
    const diff = current - previous;
    const percent =
      percentMode === 'change'
        ? previous !== 0
          ? _.floor((current - previous) / previous, 4)
          : 0
        : _.floor(current / (previous || current || 1), 4);

    return {
      previous,
      current,
      percent,
      change: SentimentService.changeConvert(diff),
      values: currentValues,
    };
  }

  async query(dto: SentimentFilterDTO) {
    try {
      const [current, compareResult] = await Promise.all([
        this.sentimentRepository.getSeriesData(dto),
        dto.compareEnabled
          ? this.sentimentRepository.getCompareSeriesData(dto)
          : Promise.resolve(null),
      ]);

      const currentCharts = dto.chartName
        ? this.processChart(dto.chartName, current, dto)
        : this.processAllCharts(current, dto);

      const compareCharts = compareResult
        ? dto.chartName
          ? this.processChart(dto.chartName, compareResult, dto)
          : this.processAllCharts(compareResult, dto)
        : null;

      const shareOfSentiment = this.wrapWithCompare(
        currentCharts.shareOfSentiment ?? [],
        compareCharts?.shareOfSentiment ?? null,
        'y',
        'change',
      );

      const result: any = {
        ...currentCharts,
        shareOfSentiment,
      };

      return result;
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }

  private processChart(
    chartName: string,
    result: TimeSeriesResult,
    dto: SentimentFilterDTO,
  ): any {
    const { series, diffHour, startDate, endDate } = result;
    const keywordNameMaps: any[] = [];

    switch (chartName) {
      case 'ShareSentiment':
        return sentShareOfSentimentChart(series, dto);
      case 'SentimentKeywordTopics':
        return sentByKeywordTopicsChart(series, dto, keywordNameMaps);
      case 'netSentimentOverTime':
        return sentOverTimeChart(
          series,
          dto,
          diffHour,
          startDate,
          endDate,
          keywordNameMaps,
        );
      case 'SentimentChannel':
        return sentByChannelChart(series, dto);
      case 'SentimentCategory':
        return sentByCategoryChart(series, dto);
      case 'SentimentTag':
        return sentByTagChart(series, dto);
      case 'NetSentiment':
        return netSentimentChart(series, dto, keywordNameMaps);
      case 'NetSentimentTotal':
        return null;
      case 'NetSentimentChannel':
        return null;
      case 'CategoryNetSentiment':
        return categoryNetSentimentChart(series, dto);
      case 'TagNetSentiment':
        return tagNetSentimentChart(series, dto);
      default:
        return null;
    }
  }

  private processAllCharts(
    result: TimeSeriesResult,
    dto: SentimentFilterDTO,
  ): any {
    const { series, diffHour, startDate, endDate } = result;
    const keywordNameMaps: any[] = [];

    return {
      shareOfSentiment: sentShareOfSentimentChart(series, dto),
      sentimentByKeywordTopics: sentByKeywordTopicsChart(
        series,
        dto,
        keywordNameMaps,
      ),
      sentimentOverTime: sentOverTimeChart(
        series,
        dto,
        diffHour,
        startDate,
        endDate,
        keywordNameMaps,
      ),
      sentimentByChannel: sentByChannelChart(series, dto),
      sentimentByCategory: sentByCategoryChart(series, dto),
      sentimentByTag: sentByTagChart(series, dto),
      netSentiment: netSentimentChart(series, dto, keywordNameMaps),
      netSentimentByTotal: null,
      netSentimentByChannel: null,
      categoryNetSentiment: categoryNetSentimentChart(series, dto),
      tagNetSentiment: tagNetSentimentChart(series, dto),
    };
  }
}

/* =====================================================================
 * Sentiment Chart Processing Functions (pure, testable)
 * ===================================================================== */

export function sentShareOfSentimentChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
): any[] {
  const ALL_SENTIMENTS = [
    Sentiment.POSITIVE,
    Sentiment.NEUTRAL,
    Sentiment.NEGATIVE,
  ];
  const data = flattenSeriesData(queryResults);

  const raw = ALL_SENTIMENTS.map((sentiment) => {
    const y = data
      .map((d) => (d.sentiment === sentiment ? 1 : 0) * d.count)
      .reduce((sum, v) => sum + v, 0);
    return { name: sentiment, y };
  });

  if (!raw.some((r) => r.y > 0)) return [];

  const total = _.sumBy(raw, 'y');
  return raw.map((r) => ({
    ...r,
    percent: total > 0 ? parseFloat(((r.y / total) * 100).toFixed(2)) : 0,
  }));
}

export function sentByKeywordTopicsChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
  keywordNameMaps: any[],
): any {
  const ALL_SENTIMENTS = [
    Sentiment.POSITIVE,
    Sentiment.NEUTRAL,
    Sentiment.NEGATIVE,
  ];
  const data = flattenSeriesData(queryResults);
  let keywords = getKeywordsFromData(data, dto.keywords);
  keywords = keywords.filter((k) => k !== 'Monitor');

  const xAxis = {
    categories: keywords.map((k) => lookupKeywordName(k, keywordNameMaps)),
    categories2: keywords,
  };

  const series = ALL_SENTIMENTS.map((sentiment) => ({
    name: sentiment,
    data: keywords.map((keyword) =>
      data
        .map(
          (d) =>
            d.count *
            (d.keyword ?? []).filter(
              (k: string) => d.sentiment === sentiment && k === keyword,
            ).length,
        )
        .reduce((sum, v) => sum + v, 0),
    ),
  })).sort((a, b) => (a.name > b.name ? -1 : 1));

  return { xAxis, series };
}

export function sentOverTimeChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
  diffHour: number,
  startDate: Date,
  endDate: Date,
  keywordNameMaps: any[],
): any {
  const allData = flattenSeriesData(queryResults);
  let keywords = getKeywordsFromData(allData, dto.keywords);
  keywords = keywords.filter((k) => k !== 'Monitor');
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const xAxis: { categories: string[] } = { categories: [] };

  const computeNetSentiment = (bucket: any, keyword: string): number => {
    if (!bucket) return 0;
    const items = bucket.data.filter((d: any) =>
      (d.keyword ?? []).includes(keyword),
    );
    const pos = items
      .filter((d: any) => d.sentiment === Sentiment.POSITIVE)
      .reduce((s: number, d: any) => s + d.count, 0);
    const neg = items
      .filter((d: any) => d.sentiment === Sentiment.NEGATIVE)
      .reduce((s: number, d: any) => s + d.count, 0);
    return parseFloat((((pos - neg) / (pos + neg || 1)) * 100).toFixed(2));
  };

  if (diffHour > 120) {
    let cursor = start.clone();
    while (!cursor.isAfter(end)) {
      xAxis.categories.push(cursor.format('YYYY-MM-DD'));
      cursor = cursor.add(1, 'day');
    }
    const series = keywords.map((keyword) => ({
      name: lookupKeywordName(keyword, keywordNameMaps),
      fullLabel: keyword,
      data: xAxis.categories.map((date) =>
        computeNetSentiment(
          queryResults.find((r) => r._id === date),
          keyword,
        ),
      ),
    }));
    const result = { xAxis, series };
    return result.series.every((s) => s.data.every((v: number) => v === 0))
      ? { ...result, series: [] }
      : result;
  } else {
    const startHour = start.hour();
    let cursor = start.clone();
    for (let i = 0; i <= diffHour; i++) {
      xAxis.categories.push(cursor.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'));
      cursor = cursor.add(1, 'hour');
    }
    const series = keywords.map((keyword) => ({
      name: lookupKeywordName(keyword, keywordNameMaps),
      fullLabel: keyword,
      data: xAxis.categories.map((_, i) => {
        const hour = (i + startHour) % 24;
        return computeNetSentiment(
          queryResults.find((r) => r._id === hour),
          keyword,
        );
      }),
    }));
    const result = { xAxis, series };
    return result.series.every((s) => s.data.every((v: number) => v === 0))
      ? { ...result, series: [] }
      : result;
  }
}

export function sentByChannelChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
): any {
  const ALL_SENTIMENTS = [
    Sentiment.POSITIVE,
    Sentiment.NEUTRAL,
    Sentiment.NEGATIVE,
  ];
  const data = flattenSeriesData(queryResults);
  const channels = getChannelsFromData(data, dto.channel);

  const series = ALL_SENTIMENTS.map((sentiment) => ({
    name: sentiment,
    data: channels.map((channel) =>
      data
        .filter((d) => d.channel?.includes(channel.replace(/\*$/, '')))
        .filter((d) => d.sentiment === sentiment)
        .reduce((sum, d) => sum + d.count, 0),
    ),
  }));

  return { xAxis: { categories: channels }, series };
}

export function sentByCategoryChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
): any {
  const ALL_SENTIMENTS = [
    Sentiment.POSITIVE,
    Sentiment.NEUTRAL,
    Sentiment.NEGATIVE,
  ];
  const data = flattenSeriesData(queryResults);
  const tags = getTagsFromData(data, dto.tags as string[] | undefined);
  const categories = [
    ...new Set(tags.map((t) => t?.split('_')[0]).filter(Boolean)),
  ].sort();

  const series = ALL_SENTIMENTS.map((sentiment) => ({
    name: sentiment,
    data: categories.map((cat) =>
      data
        .filter((d) => (d.tags ?? []).some((t: string) => t?.startsWith(cat)))
        .filter((d) => d.sentiment === sentiment)
        .reduce((sum, d) => sum + d.count, 0),
    ),
  }));

  return { xAxis: { categories }, series };
}

export function sentByTagChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
): any {
  const ALL_SENTIMENTS = [
    Sentiment.POSITIVE,
    Sentiment.NEUTRAL,
    Sentiment.NEGATIVE,
  ];
  const data = flattenSeriesData(queryResults);
  const tags = getTagsFromData(data, dto.tags as string[] | undefined);

  const series = ALL_SENTIMENTS.map((sentiment) => ({
    name: sentiment,
    data: tags.map((tag) =>
      data
        .filter((d) => (d.tags ?? []).includes(tag))
        .filter((d) => d.sentiment === sentiment)
        .reduce((sum, d) => sum + d.count, 0),
    ),
  }));

  return { xAxis: { categories: tags }, series };
}

export function netSentimentChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
  keywordNameMaps: any[],
): any {
  const data = flattenSeriesData(queryResults);
  let keywords = getKeywordsFromData(data, dto.keywords);
  keywords = keywords.filter((k) => k !== 'Monitor');

  const xAxis = {
    categories: keywords.map((k) => lookupKeywordName(k, keywordNameMaps)),
    categories2: keywords,
  };

  const series = [
    {
      name: 'net sentiment',
      data: keywords.map((keyword) => {
        const items = data.filter((d) => (d.keyword ?? []).includes(keyword));
        const pos = items
          .filter((d) => d.sentiment === Sentiment.POSITIVE)
          .reduce((s, d) => s + d.count, 0);
        const neg = items
          .filter((d) => d.sentiment === Sentiment.NEGATIVE)
          .reduce((s, d) => s + d.count, 0);
        return parseFloat((((pos - neg) / (pos + neg || 1)) * 100).toFixed(2));
      }),
    },
  ];

  return { xAxis, series };
}

export function categoryNetSentimentChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
): any {
  const data = flattenSeriesData(queryResults);
  const tags = getTagsFromData(data, dto.tags as string[] | undefined);
  const categories = [
    ...new Set(tags.map((t) => t?.split('_')[0]).filter(Boolean)),
  ].sort();

  const series = [
    {
      name: 'net sentiment',
      data: categories.map((cat) => {
        const items = data.filter((d) =>
          (d.tags ?? []).some((t: string) => t?.startsWith(cat)),
        );
        const pos = items
          .filter((d) => d.sentiment === Sentiment.POSITIVE)
          .reduce((s, d) => s + d.count, 0);
        const neg = items
          .filter((d) => d.sentiment === Sentiment.NEGATIVE)
          .reduce((s, d) => s + d.count, 0);
        return parseFloat((((pos - neg) / (pos + neg || 1)) * 100).toFixed(2));
      }),
    },
  ];

  return { xAxis: { categories }, series };
}

export function tagNetSentimentChart(
  queryResults: any[],
  dto: SentimentFilterDTO,
): any {
  const data = flattenSeriesData(queryResults);
  const tags = getTagsFromData(data, dto.tags as string[] | undefined);

  const series = [
    {
      name: 'net sentiment',
      data: tags.map((tag) => {
        const items = data.filter((d) => (d.tags ?? []).includes(tag));
        const pos = items
          .filter((d) => d.sentiment === Sentiment.POSITIVE)
          .reduce((s, d) => s + d.count, 0);
        const neg = items
          .filter((d) => d.sentiment === Sentiment.NEGATIVE)
          .reduce((s, d) => s + d.count, 0);
        return parseFloat((((pos - neg) / (pos + neg || 1)) * 100).toFixed(2));
      }),
    },
  ];

  return { xAxis: { categories: tags }, series };
}

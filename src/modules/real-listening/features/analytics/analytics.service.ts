import { BadRequestException, Injectable } from '@nestjs/common';
import _ from 'lodash';
import dayjs from 'dayjs';

import {
  AnalyticsRepository,
  TimeSeriesResult,
} from '../../infrastructure/repositories/analytics.repository';
import { AnalyticsFilterDTO } from './dto/analytics-filter.dto';
import {
  flattenSeriesData,
  getKeywordsFromData,
  getChannelsFromData,
  getTagsFromData,
  normalizeChannelName,
  lookupKeywordName,
  lookupKeywordColor,
  lookupTagColor,
  clearEmptyYData,
  clearEmptySeriesData,
} from '../../common/utils/aggregation.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async query(dto: AnalyticsFilterDTO) {
    try {
      const [current, compareResult] = await Promise.all([
        this.analyticsRepository.getSeriesData(dto),
        dto.compareEnabled
          ? this.analyticsRepository.getCompareSeriesData(dto)
          : Promise.resolve(null),
      ]);

      const currentCharts = dto.chartName
        ? this.processChart(dto.chartName, current, dto)
        : this.processAllCharts(current, dto);

      const result: any = { ...currentCharts };

      if (compareResult) {
        const compareCharts = dto.chartName
          ? this.processChart(dto.chartName, compareResult, dto)
          : this.processAllCharts(compareResult, dto);
        result.compare = compareCharts;
      }

      return result;
    } catch (error: any) {
      throw new BadRequestException([error?.message ?? String(error)]);
    }
  }

  private processChart(
    chartName: string,
    result: TimeSeriesResult,
    dto: AnalyticsFilterDTO,
  ): any {
    const { series, isDailyGrouping, diffHour, startDate, endDate } = result;
    const keywordNameMaps = (dto as any).keywordNameMaps ?? [];
    const keywordValues = (dto as any).keywordValues ?? [];
    const tagNameMaps = (dto as any).tagNameMaps ?? [];
    const tagValues = (dto as any).tagValues ?? [];

    switch (chartName) {
      case 'ShareKeyword':
        return shareOfKeywordChart(series, dto, keywordNameMaps, keywordValues);
      case 'BuzzKeyword':
        return buzzKeywordChart(
          series,
          dto,
          keywordNameMaps,
          diffHour,
          startDate,
          endDate,
          keywordValues,
        );
      case 'ShareChannel':
        return shareOfChannelChart(series, dto);
      case 'ChannelKeyword':
        return channelByKeywordChart(series, dto, keywordNameMaps);
      case 'BuzzTimeTotal':
        return buzzTimelineByTotalChart(
          series,
          dto,
          diffHour,
          startDate,
          endDate,
        );
      case 'ChannelChannel':
        return channelByChannelChart(series, dto);
      case 'BuzzTimeChannel':
        return buzzTimelineByChannelChart(
          series,
          dto,
          diffHour,
          startDate,
          endDate,
        );
      case 'ShareSentiment':
        return shareOfSentimentChart(series, dto);
      case 'SentimentOver':
        return sentimentOverTimeChart(
          series,
          dto,
          diffHour,
          startDate,
          endDate,
          keywordNameMaps,
          keywordValues,
        );
      case 'ChannelSentiment':
        return channelBySentimentChart(series, dto);
      case 'BuzzTimeTags':
        return buzzTimelineByTagsChart(
          series,
          dto,
          diffHour,
          startDate,
          endDate,
          tagNameMaps,
          tagValues,
        );
      case 'ShareTags':
        return shareOfTagsChart(series, dto, tagNameMaps, tagValues);
      case 'ChannelTags':
        return channelByTagsChart(series, dto, tagNameMaps, tagValues);
      case 'SummaryChannel':
        return summaryChannelChart(series, dto);
      default:
        return null;
    }
  }

  private processAllCharts(
    result: TimeSeriesResult,
    dto: AnalyticsFilterDTO,
  ): any {
    const { series, diffHour, startDate, endDate } = result;
    const keywordNameMaps = (dto as any).keywordNameMaps ?? [];
    const keywordValues = (dto as any).keywordValues ?? [];
    const tagNameMaps = (dto as any).tagNameMaps ?? [];
    const tagValues = (dto as any).tagValues ?? [];

    return {
      shareOfKeywordTopic: shareOfKeywordChart(
        series,
        dto,
        keywordNameMaps,
        keywordValues,
      ),
      buzzTimelineByKeywordTopics: buzzKeywordChart(
        series,
        dto,
        keywordNameMaps,
        diffHour,
        startDate,
        endDate,
        keywordValues,
      ),
      shareOfChannel: shareOfChannelChart(series, dto),
      channelByKeyword: channelByKeywordChart(series, dto, keywordNameMaps),
      buzzTimelineByTotal: buzzTimelineByTotalChart(
        series,
        dto,
        diffHour,
        startDate,
        endDate,
      ),
      channelByChannel: channelByChannelChart(series, dto),
      buzzTimelineByChannel: buzzTimelineByChannelChart(
        series,
        dto,
        diffHour,
        startDate,
        endDate,
      ),
      shareOfSentiment: shareOfSentimentChart(series, dto),
      sentimentOverTime: sentimentOverTimeChart(
        series,
        dto,
        diffHour,
        startDate,
        endDate,
        keywordNameMaps,
        keywordValues,
      ),
      channelBySentiment: channelBySentimentChart(series, dto),
      buzzTimelineByTags: buzzTimelineByTagsChart(
        series,
        dto,
        diffHour,
        startDate,
        endDate,
        tagNameMaps,
        tagValues,
      ),
      shareOfTags: shareOfTagsChart(series, dto, tagNameMaps, tagValues),
      channelByTags: channelByTagsChart(series, dto, tagNameMaps, tagValues),
      summaryChannel: summaryChannelChart(series, dto),
    };
  }
}

/* =====================================================================
 * Chart Processing Functions (pure, testable)
 * ===================================================================== */

export function shareOfKeywordChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  keywordNameMaps: any[] = [],
  keywordValues: any[] = [],
): any[] {
  const data = flattenSeriesData(queryResults);
  const keywords = getKeywordsFromData(data, dto.keywords);

  const res = keywords.map((keyword) => {
    const y = data
      .filter((d) => d.keyword?.includes(keyword))
      .reduce((sum, d) => sum + d.count, 0);
    const name = lookupKeywordName(keyword, keywordNameMaps);
    const color = lookupKeywordColor(keyword, keywordNameMaps, keywordValues);
    return { name, color, y, fullLabel: keyword };
  });

  return dto.keywords?.length
    ? res.every((r) => r.y === 0)
      ? []
      : res
    : clearEmptyYData(res);
}

export function buzzKeywordChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  keywordNameMaps: any[],
  diffHour: number,
  startDate: Date,
  endDate: Date,
  keywordValues: any[] = [],
): any {
  const data = flattenSeriesData(queryResults);
  const keywords = getKeywordsFromData(data, dto.keywords);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const xAxis: { categories: string[] } = { categories: [] };

  let series: any[];

  if (diffHour > 120) {
    let cursor = start.clone();
    while (!cursor.isAfter(end)) {
      xAxis.categories.push(cursor.format('YYYY-MM-DD'));
      cursor = cursor.add(1, 'day');
    }
    series = keywords.map((keyword) => {
      const seriesData = xAxis.categories.map((date) => {
        const bucket = queryResults.find((r) => r._id === date);
        if (!bucket) return 0;
        return bucket.data
          .filter((d: any) => d.keyword?.includes(keyword))
          .reduce((sum: number, d: any) => sum + d.count, 0);
      });
      const color = lookupKeywordColor(keyword, keywordNameMaps, keywordValues);
      return {
        name: lookupKeywordName(keyword, keywordNameMaps),
        color,
        data: seriesData,
        fullLabel: keyword,
      };
    });
  } else {
    const startHour = start.hour();
    let cursor = start.clone();
    for (let i = 0; i <= diffHour; i++) {
      xAxis.categories.push(cursor.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'));
      cursor = cursor.add(1, 'hour');
    }
    series = keywords.map((keyword) => {
      const seriesData = xAxis.categories.map((_, i) => {
        const hour = (i + startHour) % 24;
        const date = dayjs(xAxis.categories[i]).format('YYYY-MM-DD');
        const bucket = queryResults.find(
          (r) => r._id?.hour === hour && r._id?.date === date,
        );
        if (!bucket) return 0;
        return bucket.data
          .filter((d: any) => d.keyword?.includes(keyword))
          .reduce((sum: number, d: any) => sum + d.count, 0);
      });
      const color = lookupKeywordColor(keyword, keywordNameMaps, keywordValues);
      return {
        name: lookupKeywordName(keyword, keywordNameMaps),
        color,
        data: seriesData,
        fullLabel: keyword,
      };
    });
  }

  return clearEmptySeriesData({ xAxis, series });
}

export function shareOfChannelChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
): any[] {
  const data = flattenSeriesData(queryResults);
  const channels = getChannelsFromData(data, dto.channel);

  const res = channels.map((channel) => {
    const name = channel.replace(/\*$/, '');
    const y = data
      .filter((d) => d.channel?.includes(name))
      .reduce((sum, d) => sum + d.count, 0);
    return {
      name: normalizeChannelName(_.last(name.split('_')) ?? name),
      y,
      fullLabel: `${name}*`,
    };
  });

  return dto.channel?.length
    ? res.every((r) => r.y === 0)
      ? []
      : res
    : clearEmptyYData(res);
}

export function channelByKeywordChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  keywordNameMaps: any[],
): any {
  const data = flattenSeriesData(queryResults);
  const keywords = getKeywordsFromData(data, dto.keywords);
  const channels = getChannelsFromData(data, dto.channel);

  const xAxis = {
    categories: keywords.map((k) =>
      k === 'No Keyword' ? k : lookupKeywordName(k, keywordNameMaps),
    ),
    categories2: keywords,
  };

  const series = channels
    .map((channel) => {
      const name = channel.includes('*')
        ? channel.replace(/\*$/, '')
        : channel === 'facebook'
          ? 'facebook-'
          : channel === 'youtube'
            ? 'youtube-post'
            : channel;

      const seriesData = keywords.map((keyword) =>
        ([] as any[])
          .concat(...queryResults.map((r) => r.data ?? []))
          .filter(
            (d: any) =>
              d.channel?.includes(name) && d.keyword?.includes(keyword),
          )
          .reduce((sum: number, d: any) => sum + d.count, 0),
      );
      return {
        name: normalizeChannelName(name),
        data: seriesData,
        fullLabel: `${channel}*`,
      };
    })
    .sort((a, b) => (a.name > b.name ? -1 : 1));

  const result = { xAxis, series };
  return dto.channel?.length ? result : clearEmptySeriesData(result);
}

export function buzzTimelineByTotalChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  diffHour: number,
  startDate: Date,
  endDate: Date,
): any {
  const allData = flattenSeriesData(queryResults);
  const keywords = getKeywordsFromData(allData, dto.keywords);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const xAxis: { categories: string[] } = { categories: [] };
  const data: number[] = [];

  if (diffHour > 120) {
    let cursor = start.clone();
    while (!cursor.isAfter(end)) {
      const date = cursor.format('YYYY-MM-DD');
      xAxis.categories.push(date);
      const bucket = queryResults.find((r) => r._id === date);
      const count = bucket
        ? bucket.data.reduce(
            (sum: number, d: any) =>
              sum +
              (d.keyword ?? []).filter((k: string) => keywords.includes(k))
                .length *
                d.count,
            0,
          )
        : 0;
      data.push(count);
      cursor = cursor.add(1, 'day');
    }
  } else {
    const startHour = start.hour();
    let cursor = start.clone();
    for (let i = 0; i <= diffHour; i++) {
      xAxis.categories.push(cursor.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'));
      const hour = (i + startHour) % 24;
      const date = cursor.format('YYYY-MM-DD');
      const bucket = queryResults.find(
        (r) => r._id?.hour === hour && r._id?.date === date,
      );
      const count = bucket
        ? bucket.data.reduce(
            (sum: number, d: any) =>
              sum +
              (d.keyword ?? []).filter((k: string) => keywords.includes(k))
                .length *
                d.count,
            0,
          )
        : 0;
      data.push(count);
      cursor = cursor.add(1, 'hour');
    }
  }

  const series = [{ name: 'Total', data }];
  return clearEmptySeriesData({ xAxis, series });
}

export function buzzTimelineByChannelChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  diffHour: number,
  startDate: Date,
  endDate: Date,
): any {
  const allData = flattenSeriesData(queryResults);
  const channels = getChannelsFromData(allData, dto.channel);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const xAxis: { categories: string[] } = { categories: [] };

  if (diffHour > 120) {
    let cursor = start.clone();
    while (!cursor.isAfter(end)) {
      xAxis.categories.push(cursor.format('YYYY-MM-DD'));
      cursor = cursor.add(1, 'day');
    }
    const series = channels.map((channel) => {
      const name = channel.replace(/\*$/, '');
      const seriesData = xAxis.categories.map((date) => {
        const bucket = queryResults.find((r) => r._id === date);
        if (!bucket) return 0;
        return bucket.data
          .filter((d: any) => d.channel?.includes(name))
          .reduce((sum: number, d: any) => sum + d.count, 0);
      });
      return {
        name: normalizeChannelName(name),
        data: seriesData,
        fullLabel: channel,
      };
    });
    return { xAxis, series };
  } else {
    const startHour = start.hour();
    let cursor = start.clone();
    for (let i = 0; i <= diffHour; i++) {
      xAxis.categories.push(cursor.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'));
      cursor = cursor.add(1, 'hour');
    }
    const series = channels.map((channel) => {
      const name = channel.replace(/\*$/, '');
      const seriesData = xAxis.categories.map((_, i) => {
        const hour = (i + startHour) % 24;
        const date = dayjs(xAxis.categories[i]).format('YYYY-MM-DD');
        const bucket = queryResults.find(
          (r) => r._id?.hour === hour && r._id?.date === date,
        );
        if (!bucket) return 0;
        return bucket.data
          .filter((d: any) => d.channel?.includes(name))
          .reduce((sum: number, d: any) => sum + d.count, 0);
      });
      return {
        name: normalizeChannelName(name),
        data: seriesData,
        fullLabel: channel,
      };
    });
    return { xAxis, series };
  }
}

export function channelByChannelChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
): any {
  const data = flattenSeriesData(queryResults);
  const channels = getChannelsFromData(data, dto.channel);

  const series = channels
    .map((channel) => {
      const name = channel.replace(/\*$/, '');
      const y = data
        .filter((d) => d.channel?.includes(name))
        .reduce((sum, d) => sum + d.count, 0);
      return {
        name: normalizeChannelName(_.last(name.split('_')) ?? name),
        data: [y],
        fullLabel: `${name}*`,
      };
    })
    .sort((a, b) => (a.name > b.name ? -1 : 1));

  const xAxis = { categories: ['Total'] };
  const result = { xAxis, series };
  return dto.channel?.length
    ? result.series.every((s) => s.data.every((v: number) => v === 0))
      ? { ...result, series: [] }
      : result
    : clearEmptySeriesData(result);
}

export function shareOfSentimentChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
): any[] {
  const ALL_SENTIMENTS = ['positive', 'neutral', 'negative'];
  const data = flattenSeriesData(queryResults);

  const res = ALL_SENTIMENTS.map((sentiment) => {
    const y = data
      .map((d) => {
        const sm =
          (d.sentiment as string[])?.filter((s) => s === sentiment).length ?? 0;
        return sm * d.count;
      })
      .reduce((sum, v) => sum + v, 0);
    return { name: sentiment, y };
  });

  return res.every((r) => r.y === 0) ? [] : res;
}

export function sentimentOverTimeChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  diffHour: number,
  startDate: Date,
  endDate: Date,
  keywordNameMaps: any[],
  keywordValues: any[] = [],
): any {
  const allData = flattenSeriesData(queryResults);
  const keywords = getKeywordsFromData(allData, dto.keywords);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const xAxis: { categories: string[] } = { categories: [] };

  const computeNetSentiment = (bucket: any, keyword: string): number => {
    if (!bucket) return 0;
    const pos = bucket.data
      .filter((d: any) => d.keyword?.includes(keyword))
      .map(
        (d: any) =>
          (d.sentiment as string[])?.filter((s) => s === 'positive').length *
          d.count,
      )
      .reduce((sum: number, v: number) => sum + v, 0);
    const neg = bucket.data
      .filter((d: any) => d.keyword?.includes(keyword))
      .map(
        (d: any) =>
          (d.sentiment as string[])?.filter((s) => s === 'negative').length *
          d.count,
      )
      .reduce((sum: number, v: number) => sum + v, 0);
    return parseFloat((((pos - neg) / (pos + neg || 1)) * 100).toFixed(2));
  };

  if (diffHour > 120) {
    let cursor = start.clone();
    while (!cursor.isAfter(end)) {
      xAxis.categories.push(cursor.format('YYYY-MM-DD'));
      cursor = cursor.add(1, 'day');
    }
    const series = keywords.map((keyword) => {
      const color = lookupKeywordColor(keyword, keywordNameMaps, keywordValues);
      return {
        name: lookupKeywordName(keyword, keywordNameMaps),
        color,
        fullLabel: keyword,
        data: xAxis.categories.map((date) =>
          computeNetSentiment(
            queryResults.find((r) => r._id === date),
            keyword,
          ),
        ),
      };
    });
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
    const series = keywords.map((keyword) => {
      const color = lookupKeywordColor(keyword, keywordNameMaps, keywordValues);
      return {
        name: lookupKeywordName(keyword, keywordNameMaps),
        color,
        fullLabel: keyword,
        data: xAxis.categories.map((_, i) => {
          const hour = (i + startHour) % 24;
          const bucket = queryResults.find((r) => r._id === hour);
          return computeNetSentiment(bucket, keyword);
        }),
      };
    });
    const result = { xAxis, series };
    return result.series.every((s) => s.data.every((v: number) => v === 0))
      ? { ...result, series: [] }
      : result;
  }
}

export function channelBySentimentChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
): any {
  const ALL_SENTIMENTS = ['positive', 'neutral', 'negative'];
  const data = flattenSeriesData(queryResults);
  const channels = getChannelsFromData(data, dto.channel);

  const xAxis = { type: 'category' };
  const series = ALL_SENTIMENTS.map((sentiment) => ({
    name: sentiment,
    data: channels.map((channel) => {
      const name = channel.replace(/\*$/, '');
      return data
        .filter((d) => d.channel?.includes(name))
        .map(
          (d) =>
            (d.sentiment as string[])?.filter((s) => s === sentiment).length *
            d.count,
        )
        .reduce((sum, v) => sum + v, 0);
    }),
  }));

  return { xAxis: { ...xAxis, categories: channels }, series };
}

export function buzzTimelineByTagsChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  diffHour: number,
  startDate: Date,
  endDate: Date,
  tagNameMaps: any[] = [],
  tagValues: any[] = [],
): any {
  const allData = flattenSeriesData(queryResults);
  const tags = getTagsFromData(allData, dto.tags as string[] | undefined);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const xAxis: { categories: string[] } = { categories: [] };

  if (diffHour > 120) {
    let cursor = start.clone();
    while (!cursor.isAfter(end)) {
      xAxis.categories.push(cursor.format('YYYY-MM-DD'));
      cursor = cursor.add(1, 'day');
    }
    const series = tags.map((tag) => {
      const color = lookupTagColor(tag, tagNameMaps, tagValues);
      return {
        name: tag,
        color,
        fullLabel: tag,
        data: xAxis.categories.map((date) => {
          const bucket = queryResults.find((r) => r._id === date);
          if (!bucket) return 0;
          return bucket.data
            .filter((d: any) => d.tags?.includes(tag))
            .reduce((sum: number, d: any) => sum + d.count, 0);
        }),
      };
    });
    return clearEmptySeriesData({ xAxis, series });
  } else {
    const startHour = start.hour();
    let cursor = start.clone();
    for (let i = 0; i <= diffHour; i++) {
      xAxis.categories.push(cursor.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'));
      cursor = cursor.add(1, 'hour');
    }
    const series = tags.map((tag) => {
      const color = lookupTagColor(tag, tagNameMaps, tagValues);
      return {
        name: tag,
        color,
        fullLabel: tag,
        data: xAxis.categories.map((_, i) => {
          const hour = (i + startHour) % 24;
          const date = dayjs(xAxis.categories[i]).format('YYYY-MM-DD');
          const bucket = queryResults.find(
            (r) => r._id?.hour === hour && r._id?.date === date,
          );
          if (!bucket) return 0;
          return bucket.data
            .filter((d: any) => d.tags?.includes(tag))
            .reduce((sum: number, d: any) => sum + d.count, 0);
        }),
      };
    });
    return clearEmptySeriesData({ xAxis, series });
  }
}

export function shareOfTagsChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  tagNameMaps: any[] = [],
  tagValues: any[] = [],
): any[] {
  const data = flattenSeriesData(queryResults);
  const tags = getTagsFromData(data, dto.tags as string[] | undefined);

  const res = tags.map((tag) => {
    const color = lookupTagColor(tag, tagNameMaps, tagValues);
    return {
      name: tag,
      color,
      y: data
        .filter((d) => d.tags?.includes(tag))
        .reduce((sum, d) => sum + d.count, 0),
      fullLabel: tag,
    };
  });

  return dto.tags?.length
    ? res.every((r) => r.y === 0)
      ? []
      : res
    : clearEmptyYData(res);
}

export function channelByTagsChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
  _tagNameMaps: any[] = [],
  _tagValues: any[] = [],
): any {
  const data = flattenSeriesData(queryResults);
  const tags = getTagsFromData(data, dto.tags as string[] | undefined);
  const channels = getChannelsFromData(data, dto.channel);

  const xAxis = {
    categories: tags,
    categories2: tags,
  };

  const series = channels.map((channel) => {
    const name = channel.replace(/\*$/, '');
    const seriesData = tags.map((tag) =>
      data
        .filter((d) => d.channel?.includes(name) && d.tags?.includes(tag))
        .reduce((sum, d) => sum + d.count, 0),
    );
    return {
      name: normalizeChannelName(name),
      data: seriesData,
      fullLabel: `${channel}*`,
    };
  });

  const result = { xAxis, series };
  return dto.channel?.length ? result : clearEmptySeriesData(result);
}

export function summaryChannelChart(
  queryResults: any[],
  dto: AnalyticsFilterDTO,
): any[] {
  const data = flattenSeriesData(queryResults);
  const channels = getChannelsFromData(data, dto.channel);

  return channels.map((channel) => {
    const name = channel.replace(/\*$/, '');
    const channelData = data.filter((d) => d.channel?.includes(name));
    const totalCount = channelData.reduce((sum, d) => sum + d.count, 0);
    const totalMessage = channelData.reduce(
      (sum, d) => sum + (d.countMessage ?? 0),
      0,
    );
    return {
      channel: normalizeChannelName(name),
      fullLabel: `${name}*`,
      totalCount,
      totalMessage,
    };
  });
}

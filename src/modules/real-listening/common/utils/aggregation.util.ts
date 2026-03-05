import dayjs from 'dayjs';
import _ from 'lodash';

export const DATE_GROUP_DAILY = {
  $dateToString: {
    format: '%Y-%m-%d',
    date: { $toDate: '$publishedAtUnix' },
    timezone: '+07:00',
  },
};

export const SENTIMENT_COND = {
  $cond: {
    if: { $in: ['$content.sentiment', ['positive', 'negative']] },
    then: '$content.sentiment',
    else: 'neutral',
  },
};

export const KEYWORDS_NO_KEYWORD_COND = {
  $cond: [{ $eq: ['$keywords', []] }, ['No Keyword'], '$keywords'],
};

export const CHANNEL_NORMALIZE_EXPR = {
  $cond: {
    if: { $eq: ['$channel', 'youtube'] },
    then: 'youtube-post',
    else: {
      $cond: {
        if: { $eq: ['$channel', 'website'] },
        then: 'website-post',
        else: '$channel',
      },
    },
  },
};

export function buildEngagementStage(metric?: string): Record<string, any>[] {
  const metricExpressions: Record<string, any> = {
    mention: 1,
    engagement: { $ifNull: ['$totalEngagement', 0] },
    engagement_views: {
      $add: [{ $ifNull: ['$totalEngagement', 0] }, { $ifNull: ['$totalView', 0] }],
    },
  };
  return [{ $addFields: { engagement: metricExpressions[metric ?? 'mention'] ?? 1 } }];
}

export function buildMetricExpression(metric?: string): Record<string, any> {
  const metricExpressions: Record<string, any> = {
    mention: 1,
    engagement: { $ifNull: ['$totalEngagement', 0] },
    engagement_views: {
      $add: [{ $ifNull: ['$totalEngagement', 0] }, { $ifNull: ['$totalView', 0] }],
    },
  };
  return metricExpressions[metric ?? 'mention'] ?? 1;
}

export function buildComparePeriod(
  startDate: Date | string,
  endDate: Date | string,
): { start: Date; end: Date } {
  const start = dayjs(startDate);
  const end = dayjs(endDate);

  const firstDayOfMonth = start.startOf('month');
  const lastDayOfMonth = end.endOf('month');
  const isFullMonth =
    firstDayOfMonth.diff(start, 'day') === 0 && lastDayOfMonth.diff(end, 'day') === 0;

  if (isFullMonth) {
    return {
      start: start.subtract(1, 'month').startOf('month').toDate(),
      end: end.subtract(1, 'month').endOf('month').toDate(),
    };
  }

  const durationDays = end.diff(start, 'day', true);
  return {
    start: start.subtract(durationDays, 'day').toDate(),
    end: start.subtract(1, 'second').toDate(),
  };
}

export function flattenSeriesData(series: any[]): any[] {
  return ([] as any[]).concat(...series.map((s) => s.data ?? []));
}

export function getKeywordsFromData(data: any[], filterKeywords?: string[]): string[] {
  const allKeywords = [
    ...new Set<string>(([] as string[]).concat(...data.map((d) => d.keyword ?? []))),
  ];
  const hasNoKeyword = allKeywords.includes('No Keyword');

  let keywords: string[];
  if (filterKeywords?.length) {
    keywords = hasNoKeyword ? [...filterKeywords, 'No Keyword'] : [...filterKeywords];
  } else {
    keywords = allKeywords;
  }
  return keywords.sort().filter((k) => k !== 'Monitor');
}

export function getChannelsFromData(data: any[], filterChannels?: string[]): string[] {
  if (filterChannels?.length) {
    const result: string[] = [];
    for (const ch of filterChannels) {
      if (ch.endsWith('*')) {
        if (ch.startsWith('facebook')) {
          result.push('facebook', 'facebookgroup');
        } else {
          result.push(ch.replace(/\*$/, ''));
        }
      } else if (ch.endsWith('-')) {
        result.push(ch.replace(/-$/, ''));
      } else {
        result.push(ch);
      }
    }
    return [...new Set(result)].sort();
  }
  return [
    ...new Set<string>(data.map((d) => d.channel?.split('-')[0]).filter(Boolean)),
  ].sort();
}

export function getTagsFromData(data: any[], filterTags?: string[], exTags?: string[]): string[] {
  let tags: string[];
  if (filterTags?.length) {
    tags = filterTags;
  } else {
    tags = [...new Set<string>(([] as string[]).concat(...data.map((d) => d.tags ?? [])))];
  }

  if (exTags?.length) {
    const excludeSet = new Set(exTags);
    tags = tags.filter((t) => !excludeSet.has(t));
  }

  return tags.filter((t) => t !== undefined).sort();
}

export function normalizeChannelName(name: string): string {
  return name.replace('facebook-', 'facebookpage-').replace('youtube-post', 'youtube');
}

export function lookupKeywordName(
  keyword: string,
  keywordNameMaps: any[],
): string {
  const id = _.last(keyword.split('_')) ?? keyword;
  return keywordNameMaps.find((k) => k._id == id)?.name ?? id;
}

export function clearEmptyYData(arr: any[]): any[] {
  return arr.filter((item) => item.y !== 0);
}

export function clearEmptySeriesData(result: {
  xAxis: any;
  series: any[];
}): { xAxis: any; series: any[] } {
  if (!result?.series) return result;
  result.series = result.series.filter((serie) => !serie.data.every((d: any) => d === 0));
  return result;
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import dayjs from 'dayjs';

import {
  SocialMessage,
  SocialMessageDocument,
} from '../schemas/social-message.schema';
import { BaseRepository } from 'src/core/database/base.repository';
import { SocialQueryBuilderService } from '../../domain/services/social-query-builder.service';
import { AnalyticsFilterDTO } from '../../features/analytics/dto/analytics-filter.dto';
import {
  DATE_GROUP_DAILY,
  SENTIMENT_COND,
  CHANNEL_NORMALIZE_EXPR,
  KEYWORDS_NO_KEYWORD_COND,
  buildEngagementStage,
  buildComparePeriod,
} from '../../common/utils/aggregation.util';
import { FilterQueryDTO } from '../../domain/filter-query.dto';

export interface TimeSeriesResult {
  series: any[];
  isDailyGrouping: boolean;
  diffHour: number;
  startDate: Date;
  endDate: Date;
}

/** Max time for analytics aggregation (ms). Prevents request from hanging. */
const AGGREGATE_MAX_TIME_MS = 120_000;

@Injectable()
export class AnalyticsRepository extends BaseRepository<SocialMessageDocument> {
  constructor(
    @InjectModel(SocialMessage.name)
    model: Model<SocialMessageDocument>,
    private readonly queryBuilder: SocialQueryBuilderService,
  ) {
    super(model);
  }

  async getSeriesData(
    dto: Partial<FilterQueryDTO>,
    overrideStart?: Date,
    overrideEnd?: Date,
  ): Promise<TimeSeriesResult> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const match = { ...built.match };
    const startDate = overrideStart ?? new Date(dto.startDate!);
    const endDate = overrideEnd ?? new Date(dto.endDate!);

    if (overrideStart && overrideEnd) {
      if (match.publishedAtUnix) {
        match.publishedAtUnix = { $gte: overrideStart, $lte: overrideEnd };
      } else if (match.publisheddate) {
        match.publisheddate = { $gte: overrideStart, $lte: overrideEnd };
      }
    }

    const diffHour = dayjs(endDate).diff(dayjs(startDate), 'hour');
    const isDailyGrouping = diffHour > 120;
    const engagementStages = buildEngagementStage(dto.metric);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];

    const pipeline: any[] = isDailyGrouping
      ? this.buildDailyPipeline(advanceStages, match, engagementStages)
      : this.buildHourlyPipeline(advanceStages, match, engagementStages);
    const series = await this.findAggregate(pipeline, {
      hint: built.hint,
      maxTimeMS: AGGREGATE_MAX_TIME_MS,
      allowDiskUse: true,
    });
    return { series, isDailyGrouping, diffHour, startDate, endDate };
  }

  async getCompareSeriesData(
    dto: AnalyticsFilterDTO,
  ): Promise<TimeSeriesResult> {
    const { start, end } = buildComparePeriod(dto.startDate!, dto.endDate!);
    return this.getSeriesData(dto, start, end);
  }

  private buildDailyPipeline(
    advanceStages: any[],
    match: any,
    engagementStages: any[],
  ): any[] {
    return [
      ...advanceStages,
      { $match: match },
      ...engagementStages,
      {
        $group: {
          _id: {
            channel: CHANNEL_NORMALIZE_EXPR,
            keywords: KEYWORDS_NO_KEYWORD_COND,
            keyword_sentiment: '$keyword_sentiment',
            keyword_tag: '$keyword_tag',
            tags: '$tags',
            sentiment: SENTIMENT_COND,
            date: DATE_GROUP_DAILY,
          },
          count: { $sum: '$engagement' },
          countMessage: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          data: {
            $push: {
              channel: '$_id.channel',
              keyword: '$_id.keywords',
              keyword_sentiment: '$_id.keyword_sentiment',
              keyword_tag: '$_id.keyword_tag',
              tags: '$_id.tags',
              sentiment: ['$_id.sentiment'],
              count: '$count',
              countMessage: '$countMessage',
            },
          },
          count: { $sum: '$count' },
        },
      },
    ];
  }

  private buildHourlyPipeline(
    advanceStages: any[],
    match: any,
    engagementStages: any[],
  ): any[] {
    return [
      ...advanceStages,
      { $match: match },
      ...engagementStages,
      {
        $group: {
          _id: {
            channel: CHANNEL_NORMALIZE_EXPR,
            keywords: KEYWORDS_NO_KEYWORD_COND,
            keyword_sentiment: '$keyword_sentiment',
            keyword_tag: '$keyword_tag',
            tags: '$tags',
            hour: '$hour',
            sentiment: SENTIMENT_COND,
            date: DATE_GROUP_DAILY,
          },
          count: { $sum: '$engagement' },
          countMessage: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: { hour: '$_id.hour', date: '$_id.date' },
          data: {
            $push: {
              channel: '$_id.channel',
              keyword: '$_id.keywords',
              keyword_sentiment: '$_id.keyword_sentiment',
              keyword_tag: '$_id.keyword_tag',
              tags: '$_id.tags',
              sentiment: ['$_id.sentiment'],
              count: '$count',
              countMessage: '$countMessage',
            },
          },
          count: { $sum: '$count' },
        },
      },
    ];
  }
}

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
import { SentimentFilterDTO } from '../../features/sentiment/dto/sentiment-filter.dto';
import {
  DATE_GROUP_DAILY,
  SENTIMENT_COND,
  KEYWORDS_NO_KEYWORD_COND,
  buildEngagementStage,
  buildComparePeriod,
} from '../../common/utils/aggregation.util';
import { TimeSeriesResult } from './analytics.repository';

@Injectable()
export class SentimentRepository extends BaseRepository<SocialMessageDocument> {
  constructor(
    @InjectModel(SocialMessage.name)
    model: Model<SocialMessageDocument>,
    private readonly queryBuilder: SocialQueryBuilderService,
  ) {
    super(model);
  }

  async getSeriesData(
    dto: SentimentFilterDTO,
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

    const series = await this.findAggregate(pipeline, { hint: built.hint });
    return { series, isDailyGrouping, diffHour, startDate, endDate };
  }

  async getCompareSeriesData(dto: SentimentFilterDTO): Promise<TimeSeriesResult> {
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
            channel: '$channel',
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
              sentiment: '$_id.sentiment',
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
            channel: '$channel',
            keywords: KEYWORDS_NO_KEYWORD_COND,
            keyword_sentiment: '$keyword_sentiment',
            keyword_tag: '$keyword_tag',
            tags: '$tags',
            hour: '$hour',
            sentiment: SENTIMENT_COND,
          },
          count: { $sum: '$engagement' },
          countMessage: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.hour',
          data: {
            $push: {
              channel: '$_id.channel',
              keyword: '$_id.keywords',
              keyword_sentiment: '$_id.keyword_sentiment',
              keyword_tag: '$_id.keyword_tag',
              tags: '$_id.tags',
              sentiment: '$_id.sentiment',
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

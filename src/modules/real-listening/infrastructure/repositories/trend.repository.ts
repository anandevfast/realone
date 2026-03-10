import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  SocialMessage,
  SocialMessageDocument,
} from '../schemas/social-message.schema';
import { BaseRepository } from 'src/core/database/base.repository';
import { SocialQueryBuilderService } from '../../domain/services/social-query-builder.service';
import { TrendFilterDTO } from '../../features/trend/dto/trend-filter.dto';
import {
  buildEngagementStage,
  buildMetricExpression,
} from '../../common/utils/aggregation.util';

@Injectable()
export class TrendRepository extends BaseRepository<SocialMessageDocument> {
  constructor(
    @InjectModel(SocialMessage.name)
    model: Model<SocialMessageDocument>,
    private readonly queryBuilder: SocialQueryBuilderService,
  ) {
    super(model);
  }

  async getSpeakerTypeData(dto: TrendFilterDTO): Promise<any[]> {
    return this.getTypeData(dto, 'speakerType');
  }

  async getIntentData(dto: TrendFilterDTO): Promise<any[]> {
    return this.getTypeData(dto, 'intent');
  }

  private async getTypeData(dto: TrendFilterDTO, type: string): Promise<any[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];
    const engagementStages = buildEngagementStage(dto.metric);

    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      ...engagementStages,
      {
        $group: {
          _id: `$${type}`,
          totalEngagement: { $sum: { $ifNull: ['$totalEngagement', 0] } },
          mention: { $sum: 1 },
          engagementView: {
            $sum: {
              $add: [
                { $ifNull: ['$totalEngagement', 0] },
                { $ifNull: ['$totalView', 0] },
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    return this.findAggregate(pipeline, { hint: built.hint });
  }

  async getTop100Words(dto: TrendFilterDTO): Promise<any[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];
    const metric = dto.metric ?? 'mention';

    const metricExpression: Record<string, any> = {
      mention: { $sum: '$content.wordcloud.word.count' },
      engagement: { $sum: { $ifNull: ['$totalEngagement', 0] } },
      engagement_views: {
        $sum: {
          $add: [
            { $ifNull: ['$totalEngagement', 0] },
            { $ifNull: ['$totalView', 0] },
          ],
        },
      },
    };

    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      { $unwind: '$content.wordcloud.word' },
      {
        $group: {
          _id: '$content.wordcloud.word.word',
          count: metricExpression[metric] ?? metricExpression.mention,
          countMessages: { $count: {} },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 100 },
      { $project: { _id: 0, name: '$_id', value: '$count', countMessages: 1 } },
    ];

    return this.findAggregate(pipeline, { hint: built.hint });
  }

  async getTop100Hashtags(dto: TrendFilterDTO): Promise<any[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];
    const metric = dto.metric ?? 'mention';

    const metricExpression: Record<string, any> = {
      mention: { $sum: '$content.wordcloud.hashtag.count' },
      engagement: { $sum: { $ifNull: ['$totalEngagement', 0] } },
      engagement_views: {
        $sum: {
          $add: [
            { $ifNull: ['$totalEngagement', 0] },
            { $ifNull: ['$totalView', 0] },
          ],
        },
      },
    };

    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      { $unwind: '$content.wordcloud.hashtag' },
      {
        $group: {
          _id: '$content.wordcloud.hashtag.word',
          count: metricExpression[metric] ?? metricExpression.mention,
          countMessages: { $count: {} },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 100 },
      { $project: { _id: 0, name: '$_id', value: '$count', countMessages: 1 } },
    ];

    return this.findAggregate(pipeline, { hint: built.hint });
  }

  async getGenderData(dto: TrendFilterDTO): Promise<any[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];
    const metricExpr = buildMetricExpression(dto.metric);

    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      {
        $group: {
          _id: '$content.gender',
          count: { $sum: metricExpr },
        },
      },
      { $sort: { count: -1 } },
      { $project: { _id: 0, gender: '$_id', value: '$count' } },
    ];

    return this.findAggregate(pipeline, { hint: built.hint });
  }

  async getGenderAgeData(dto: TrendFilterDTO): Promise<any[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];
    const metric = dto.metric ?? 'mention';

    const metricExpression: Record<string, any> = {
      mention: 1,
      engagement: { $ifNull: ['$totalEngagement', 0] },
      engagement_views: {
        $add: [
          { $ifNull: ['$totalEngagement', 0] },
          { $ifNull: ['$totalView', 0] },
        ],
      },
    };
    const metricExpr = metricExpression[metric] ?? 1;

    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      {
        $bucket: {
          groupBy: '$content.age',
          boundaries: [11, 21, 31, 41, 51, 61, 100],
          default: 'unknown',
          output: {
            maleValue: {
              $sum: {
                $cond: [{ $eq: ['$content.gender', 'male'] }, metricExpr, 0],
              },
            },
            femaleValue: {
              $sum: {
                $cond: [{ $eq: ['$content.gender', 'female'] }, metricExpr, 0],
              },
            },
            unknownValue: {
              $sum: {
                $cond: [{ $eq: ['$content.gender', 'unknown'] }, metricExpr, 0],
              },
            },
          },
        },
      },
      {
        $addFields: {
          ageRange: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 11] }, then: '11-20' },
                { case: { $eq: ['$_id', 21] }, then: '21-30' },
                { case: { $eq: ['$_id', 31] }, then: '31-40' },
                { case: { $eq: ['$_id', 41] }, then: '41-50' },
                { case: { $eq: ['$_id', 51] }, then: '51-60' },
                { case: { $eq: ['$_id', 61] }, then: '> 60' },
                { case: { $eq: ['$_id', 'unknown'] }, then: 'unknown' },
              ],
              default: 'unknown',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          ageRange: 1,
          male: '$maleValue',
          female: '$femaleValue',
          unknown: '$unknownValue',
        },
      },
    ];

    return this.findAggregate(pipeline, { hint: built.hint });
  }
}

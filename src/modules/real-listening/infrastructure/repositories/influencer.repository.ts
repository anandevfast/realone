import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  SocialMessage,
  SocialMessageDocument,
} from '../schemas/social-message.schema';
import { BaseRepository } from 'src/core/database/base.repository';
import { SocialQueryBuilderService } from '../../domain/services/social-query-builder.service';
import { InfluencerFilterDTO } from '../../features/influencer/dto/influencer-filter.dto';
import {
  SENTIMENT_COND,
  DATE_GROUP_DAILY,
} from '../../common/utils/aggregation.util';

export interface InfluencerRawResult {
  _id: {
    channel: string;
    keywords: string[];
    keyword_sentiment: string[];
    keyword_tag: string[];
    sentiment: string;
  };
  arr_name: string[];
  arr_domain: string[];
}

@Injectable()
export class InfluencerRepository extends BaseRepository<SocialMessageDocument> {
  constructor(
    @InjectModel(SocialMessage.name)
    model: Model<SocialMessageDocument>,
    private readonly queryBuilder: SocialQueryBuilderService,
  ) {
    super(model);
  }

  async getGroupedData(
    dto: InfluencerFilterDTO,
  ): Promise<InfluencerRawResult[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];

    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      {
        $project: {
          channel: '$channel',
          keywords: '$keywords',
          keyword_sentiment: '$keyword_sentiment',
          keyword_tag: '$keyword_tag',
          sentiment: SENTIMENT_COND,
          date: DATE_GROUP_DAILY,
          name: {
            $ifNull: [
              '$content.from.name',
              {
                $ifNull: [
                  '$content.user.name',
                  {
                    $ifNull: [
                      '$content.author',
                      {
                        $ifNull: [
                          '$content.user.username',
                          '$content.username',
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          domain: '$domain',
        },
      },
      {
        $group: {
          _id: {
            channel: '$channel',
            keywords: '$keywords',
            keyword_sentiment: '$keyword_sentiment',
            keyword_tag: '$keyword_tag',
            sentiment: '$sentiment',
          },
          arr_name: { $addToSet: '$name' },
          arr_domain: { $addToSet: '$domain' },
        },
      },
    ];

    return this.findAggregate<InfluencerRawResult>(pipeline, {
      hint: built.hint,
    });
  }

  async getTopInfluencer(dto: InfluencerFilterDTO): Promise<any[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];

    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      {
        $group: {
          _id: {
            name: {
              $ifNull: [
                '$content.from.name',
                {
                  $ifNull: [
                    '$content.user.name',
                    { $ifNull: ['$content.author', '$content.username'] },
                  ],
                },
              ],
            },
            domain: '$domain',
            channel: { $arrayElemAt: [{ $split: ['$channel', '-'] }, 0] },
          },
          totalEngagement: { $sum: { $ifNull: ['$totalEngagement', 0] } },
          totalView: { $sum: { $ifNull: ['$totalView', 0] } },
          mention: { $sum: 1 },
          follower: { $max: '$follower' },
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$totalEngagement', 0.4] },
              { $multiply: ['$mention', 0.3] },
              { $multiply: [{ $ifNull: ['$follower', 0] }, 0.3] },
            ],
          },
        },
      },
      { $sort: { score: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          name: '$_id.name',
          domain: '$_id.domain',
          channel: '$_id.channel',
          totalEngagement: 1,
          totalView: 1,
          mention: 1,
          follower: 1,
          score: 1,
        },
      },
    ];

    return this.findAggregate(pipeline, { hint: built.hint });
  }
}

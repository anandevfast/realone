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
  PIC_PROFILE_COND,
  SUB_URL_COND,
  buildComparePeriod,
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

  /**
   * Builds the top-influencer aggregation pipeline for a given match and advance stages.
   * Used for both current and compare period.
   */
  private buildTopInfluencerPipeline(match: any, advanceStages: any[]): any[] {
    return [
      ...advanceStages,
      { $match: match },
      {
        $project: {
          _id: {
            $ifNull: [
              '$content.from.id',
              {
                $ifNull: [
                  '$content.user.id_str',
                  {
                    $ifNull: [
                      '$content.uid',
                      {
                        $ifNull: [
                          '$content.pageName',
                          { $ifNull: ['$content.uid', '$content.author_id'] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          channel: '$channel',
          domain: '$domain',
          name: {
            $ifNull: [
              '$content.from.name',
              {
                $ifNull: [
                  '$content.user.name',
                  {
                    $ifNull: [
                      '$content.user.username',
                      {
                        $ifNull: [
                          '$content.snippet.channelTitle',
                          { $ifNull: ['$content.username', '$content.author'] },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          pic_profile: PIC_PROFILE_COND,
          follower: {
            $ifNull: [
              '$follower',
              {
                $ifNull: [
                  '$content.follower',
                  {
                    $ifNull: [
                      '$content.from.followers_count',
                      {
                        $ifNull: [
                          '$content.user.followers_count',
                          {
                            $ifNull: [
                              '$content.followers',
                              {
                                $ifNull: ['$content.user.edge_followed_by', 0],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          subUrl: SUB_URL_COND,
          engagement: { $ifNull: ['$totalEngagement', 0] },
        },
      },
      { $match: { _id: { $ne: '' } } },
      {
        $group: {
          _id: '$_id',
          channel: { $first: '$channel' },
          name: { $first: '$name' },
          pic_profile: { $first: '$pic_profile' },
          follower: { $first: '$follower' },
          subUrl: { $first: '$subUrl' },
          post: { $sum: 1 },
          engagement: { $sum: '$engagement' },
          domain: { $first: '$domain' },
        },
      },
      { $match: { name: { $ne: null } } },
    ];
  }

  /**
   * Returns current-period top influencers and, when compareEnabled, the previous-period
   * data so the service can compute follower (and optional engagement/post) percent and change.
   */
  async getTopInfluencer(
    dto: InfluencerFilterDTO,
  ): Promise<{ current: any[]; compare: any[] | null }> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];
    const pipelineCurrent = this.buildTopInfluencerPipeline(
      built.match,
      advanceStages,
    );

    if (!dto.compareEnabled) {
      const current = await this.findAggregate(pipelineCurrent, {
        hint: built.hint,
      });
      return { current, compare: null };
    }

    const { start, end } = buildComparePeriod(dto.startDate!, dto.endDate!);
    const compareDto = {
      ...dto,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
    const compareBuilt = await this.queryBuilder.buildQuery(
      compareDto as InfluencerFilterDTO,
      dto.email,
    );
    const advanceStagesCompare: any[] = compareBuilt.advanceSearchFields
      ? [compareBuilt.advanceSearchFields]
      : [];
    const pipelineCompare = this.buildTopInfluencerPipeline(
      compareBuilt.match,
      advanceStagesCompare,
    );

    const [current, compare] = await Promise.all([
      this.findAggregate(pipelineCurrent, { hint: built.hint }),
      this.findAggregate(pipelineCompare, { hint: compareBuilt.hint }),
    ]);

    return { current, compare };
  }
}

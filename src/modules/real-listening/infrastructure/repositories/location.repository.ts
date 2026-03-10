import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  SocialMessage,
  SocialMessageDocument,
} from '../schemas/social-message.schema';
import { BaseRepository } from 'src/core/database/base.repository';
import { SocialQueryBuilderService } from '../../domain/services/social-query-builder.service';
import { LocationFilterDTO } from '../../features/location/dto/location-filter.dto';
import {
  buildEngagementStage,
  buildComparePeriod,
} from '../../common/utils/aggregation.util';

export interface LocationRawItem {
  _id: string;
  count: number;
  place: { ll?: number[]; name?: string };
}

@Injectable()
export class LocationRepository extends BaseRepository<SocialMessageDocument> {
  constructor(
    @InjectModel(SocialMessage.name)
    model: Model<SocialMessageDocument>,
    private readonly queryBuilder: SocialQueryBuilderService,
  ) {
    super(model);
  }

  async getLocationData(
    dto: LocationFilterDTO,
    overrideStart?: Date,
    overrideEnd?: Date,
  ): Promise<LocationRawItem[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const match = { ...built.match };

    if (overrideStart && overrideEnd) {
      if (match.publishedAtUnix) {
        match.publishedAtUnix = { $gte: overrideStart, $lte: overrideEnd };
      } else if (match.publisheddate) {
        match.publisheddate = { $gte: overrideStart, $lte: overrideEnd };
      }
    }

    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];
    const engagementStages = buildEngagementStage(dto.metric);

    const provinceFilter = {
      $or: [
        { provinceName: { $nin: [null, 'Nan', ''] } },
        {
          'center_data.location.province': {
            $exists: true,
            $nin: [null, 'Nan', ''],
          },
        },
        {
          'content.location.province': {
            $exists: true,
            $nin: [null, 'Nan', ''],
          },
        },
      ],
    };

    const combinedMatch = { ...match };
    if (combinedMatch.$and) {
      combinedMatch.$and = [...combinedMatch.$and, provinceFilter];
    } else {
      combinedMatch.$and = [provinceFilter];
    }

    const pipeline: any[] = [
      ...advanceStages,
      { $match: combinedMatch },
      ...engagementStages,
      {
        $addFields: {
          provinceName: {
            $ifNull: [
              '$provinceName',
              '$center_data.location.province',
              '$content.location.province',
            ],
          },
        },
      },
      {
        $group: {
          _id: '$provinceName',
          count: { $sum: 1 },
          place: {
            $first: {
              $ifNull: [
                '$place',
                '$center_data.location.place',
                '$content.location.place',
                {},
              ],
            },
          },
        },
      },
      { $sort: { count: -1 } },
    ];

    return this.findAggregate<LocationRawItem>(pipeline, { hint: built.hint });
  }

  async getCompareLocationData(
    dto: LocationFilterDTO,
  ): Promise<LocationRawItem[]> {
    const { start, end } = buildComparePeriod(dto.startDate!, dto.endDate!);
    return this.getLocationData(dto, start, end);
  }
}

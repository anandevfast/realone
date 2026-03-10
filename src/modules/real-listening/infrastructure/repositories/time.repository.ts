import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  SocialMessage,
  SocialMessageDocument,
} from '../schemas/social-message.schema';
import { BaseRepository } from 'src/core/database/base.repository';
import { SocialQueryBuilderService } from '../../domain/services/social-query-builder.service';
import { TimeFilterDTO } from '../../features/time/dto/time-filter.dto';
import {
  DATE_GROUP_DAILY,
  buildEngagementStage,
} from '../../common/utils/aggregation.util';

export interface TimeRawItem {
  _id: { hour: number; date: string; keywords: string };
  count: number;
}

@Injectable()
export class TimeRepository extends BaseRepository<SocialMessageDocument> {
  constructor(
    @InjectModel(SocialMessage.name)
    model: Model<SocialMessageDocument>,
    private readonly queryBuilder: SocialQueryBuilderService,
  ) {
    super(model);
  }

  async getTimeData(dto: TimeFilterDTO): Promise<TimeRawItem[]> {
    const built = await this.queryBuilder.buildQuery(dto, dto.email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];
    const engagementStages = buildEngagementStage(dto.metric);

    const pipeline: any[] = [
      { $unwind: '$keywords' },
      ...advanceStages,
      { $match: built.match },
      ...engagementStages,
      {
        $group: {
          _id: {
            hour: '$hour',
            date: DATE_GROUP_DAILY,
            keywords: '$keywords',
          },
          count: { $sum: '$engagement' },
        },
      },
    ];

    return this.findAggregate<TimeRawItem>(pipeline, { hint: built.hint });
  }
}

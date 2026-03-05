import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { SocialMessage, SocialMessageDocument } from '../schemas/social-message.schema';
import { BaseRepository } from 'src/core/database/base.repository';
import {
  SocialQueryBuilderService,
  BuiltSocialQuery,
} from '../../domain/services/social-query-builder.service';
import { FilterQueryDTO } from '../../domain/filter-query.dto';
import { getProjectSocialMessage } from '../../common/constants/projection.constant';

@Injectable()
export class MessagesRepository extends BaseRepository<SocialMessageDocument> {
  constructor(
    @InjectModel(SocialMessage.name)
    messageModel: Model<SocialMessageDocument>,
    private readonly queryBuilder: SocialQueryBuilderService,
  ) {
    super(messageModel);
  }

  async findByFilter(
    dto: Partial<FilterQueryDTO>,
    email?: string,
  ): Promise<SocialMessage[]> {
    const built: BuiltSocialQuery = await this.queryBuilder.buildQuery(dto, email);
    const skip = built.skip ?? 0;
    const limit = built.limit ?? 0;

    return this.find(built.match, {}, built.sort, skip, limit, {
      hint: built.hint,
    }) as Promise<SocialMessage[]>;
  }

  /** Default max time for aggregation (ms). Prevents request from hanging. */
  private static readonly AGGREGATE_MAX_TIME_MS = 150_000;

  async findByFilterWithPagination(
    dto: Partial<FilterQueryDTO> & { page?: number; pagePer?: number },
    email?: string,
  ): Promise<{ data: SocialMessage[]; totalCount: number; lastPage: number }> {
    const built: BuiltSocialQuery = await this.queryBuilder.buildQuery(dto, email);
    const page = dto.page ?? 1;
    const pagePer = dto.pagePer ?? 20;
    const skip = (page - 1) * pagePer;
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];

    // Optional: apply projection to reduce payload (disable if results are empty)
    const project = getProjectSocialMessage();
  
    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      { $sort: built.sort ?? { publishedAtUnix: -1 } },
      { $skip: skip },
      { $limit: pagePer },
      { $project : project}
    ];
    const opts = {
      hint: built.hint,
      maxTimeMS: MessagesRepository.AGGREGATE_MAX_TIME_MS,
    };
    const result = await this.findAggregate<SocialMessage>(pipeline, opts);
    const data = result ?? [];
    const totalCount = data.length;
    return { data, totalCount : totalCount, lastPage: Math.ceil(totalCount / pagePer) };
  }

  async countByFilter(
    dto: Partial<FilterQueryDTO>,
    email?: string,
  ): Promise<number> {
    const built: BuiltSocialQuery = await this.queryBuilder.buildQuery(dto, email);
    const advanceStages: any[] = built.advanceSearchFields
      ? [built.advanceSearchFields]
      : [];

    const pipeline: any[] = [
      ...advanceStages,
      { $match: built.match },
      { $count: 'count' },
    ];

    const result = await this.findAggregate<{ count: number }>(pipeline, {
      hint: built.hint,
      maxTimeMS: MessagesRepository.AGGREGATE_MAX_TIME_MS,
    });
    return result[0]?.count ?? 0;
  }
}

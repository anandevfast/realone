import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  SocialMessage,
  SocialMessageDocument,
} from '../schemas/social-message.schema';
import { BaseRepository } from 'src/core/database/base.repository';
import {
  SocialQueryBuilderService,
  BuiltSocialQuery,
} from '../../domain/services/social-query-builder.service';
import { FilterQueryDTO } from '../../domain/filter-query.dto';

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
    const built: BuiltSocialQuery = await this.queryBuilder.buildQuery(
      dto,
      email,
    );

    const skip = built.skip ?? 0;
    const limit = built.limit ?? 0;

    return this.find(built.match, {}, built.sort, skip, limit, {
      hint: built.hint,
    }) as Promise<SocialMessage[]>;
  }
}

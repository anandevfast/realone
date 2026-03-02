import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import _ from 'lodash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Bangkok');

import {
  SORT_FIELD_MAP,
  SIMPLE_IN_FIELDS,
} from '../../common/constants/query-map.constant';
import {
  expandChannels,
  buildMonitorOr,
  isCompoundMigrationReady,
} from '../../common/utils/query-builder.util';
import { FilterQueryDTO } from '../filter-query.dto';
import { FavoriteMessage } from '../social-enum';

export interface BuiltSocialQuery {
  match: Record<string, any>;
  sort: Record<string, any>;
  hint?: Record<string, any>;
  skip?: number;
  limit?: number;
}

@Injectable()
export class SocialQueryBuilderService {
  async buildQuery(
    dto: Partial<FilterQueryDTO>,
    email?: string,
  ): Promise<BuiltSocialQuery> {
    const input = _.cloneDeep(dto);
    const result: BuiltSocialQuery = {
      match: {},
      sort: {},
      hint: {},
    };

    // สมมติฐาน: เช็ค Index จาก DB
    const dbIndexes: any[] = [];
    const compoundReady = isCompoundMigrationReady(dbIndexes);

    /* ===============================
     * DATE RANGE (🔥 เปลี่ยนมาใช้ dayjs)
     * =============================== */
    if (input.startDate && input.endDate) {
      const start = dayjs(input.startDate).startOf('day');
      const end = dayjs(input.endDate).endOf('day');

      if (!compoundReady) {
        result.match.publisheddate = {
          $gte: start.toDate(),
          $lte: end.toDate(),
        };
      } else {
        result.match.publishedAtUnix = {
          $gte: start.toDate(),
          $lte: end.toDate(),
        };
      }
    }

    /* ===============================
     * SORT
     * =============================== */
    if (input.sortBy) {
      const [rawKey, order] = String(input.sortBy).split('-');
      const sortKey = SORT_FIELD_MAP[rawKey] || rawKey;
      result.sort = { [sortKey]: order === 'asc' ? 1 : -1 };
    } else {
      result.sort = { publishedAtUnix: -1 };
    }

    /* ===============================
     * CHANNEL
     * =============================== */
    if (input.channel?.length) {
      result.match.channel = { $in: expandChannels(input.channel) };
    }

    /* ===============================
     * KEYWORDS & MONITOR
     * =============================== */
    if (input.keywords?.length) {
      const noKeyword = input.keywords.includes('No Keyword');
      const keywordClause = noKeyword ? { $in: [] } : { $in: input.keywords };

      if ((input as any).monitor && Object.keys((input as any).monitor).length) {
        const condition = (input as any).condition || 'or';
        let monitorOperator = '$in';
        if (condition === 'keywordAndNotMonitor') {
          monitorOperator = '$nin';
        }

        const monitorOrList = buildMonitorOr(
          (input as any).monitor,
          monitorOperator,
        );

        if (monitorOrList.length) {
          const monitorClause = { $or: monitorOrList };

          if (condition === 'and' || condition === 'keywordAndNotMonitor') {
            result.match.$and = [{ keywords: keywordClause }, monitorClause];
          } else if (condition === 'or') {
            result.match.$or = [{ keywords: keywordClause }, monitorClause];
          }
        }
      } else {
        result.match.keywords = keywordClause;
      }
    }

    /* ===============================
     * FAVORITE
     * =============================== */
    if (input.favoriteMessage?.length && email) {
      const isFavorite = input.favoriteMessage.includes(FavoriteMessage.Favorite);

      // Mock data จำลองตอนต่อ DB
      const userFavData: any = { favorites: [] };

      if (!_.isEmpty(userFavData)) {
        const favIds = userFavData.favorites.map(
          (o: any) => new Types.ObjectId(o.id),
        );
        result.match._id = isFavorite ? { $in: favIds } : { $nin: favIds };
      }
    }

    /* ===============================
     * SIMPLE $in FIELDS
     * =============================== */
    for (const f of SIMPLE_IN_FIELDS) {
      if (Array.isArray((input as any)[f]) && (input as any)[f].length) {
        result.match[f] = { $in: (input as any)[f] };
      }
    }

    /* ===============================
     * RAW CONTENT (Always)
     * =============================== */
    result.match['rawContent.save_import'] = { $nin: [false] };

    // หมายเหตุ: ส่วนของ Language Regex และ Hint คุณสามารถก็อปปี้ Logic จากของเดิมมาใส่ต่อท้ายตรงนี้ได้เลยครับ

    return result;
  }
}


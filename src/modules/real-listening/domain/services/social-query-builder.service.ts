import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Cache } from 'cache-manager';
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
  LANGUAGE_REGEX_MAP,
  LANGUAGE_SEARCH_FIELDS,
} from '../../common/constants/query-map.constant';
import {
  expandChannels,
  buildMonitorOr,
  isCompoundMigrationReady,
  buildMongoHint,
  type MongoIndexSpec,
} from '../../common/utils/query-builder.util';
import { FilterQueryDTO } from '../filter-query.dto';
import { FavoriteMessage } from '../social-enum';
import type { SocialMessageDocument } from '../../infrastructure/schemas/social-message.schema';
import { SocialMessage } from '../../infrastructure/schemas/social-message.schema';

export interface BuiltSocialQuery {
  match: Record<string, any>;
  sort: Record<string, any>;
  hint?: Record<string, any>;
  skip?: number;
  limit?: number;
  advanceSearchFields?: Record<string, any>;
}

const INDEXES_CACHE_KEY = 'real-listening:indexes:social_messages';
const INDEXES_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

@Injectable()
export class SocialQueryBuilderService {
  constructor(
    @InjectModel(SocialMessage.name)
    private readonly messageModel: Model<SocialMessageDocument>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Get MongoDB indexes for the collection (cached).
   * Uses Nest CacheModule; equivalent to getIndexesMongo(collectionName) with Redis.
   */
  async getIndexes(collectionName: string = 'social_messages'): Promise<MongoIndexSpec[]> {
    try {
      const cached = await this.cache.get<MongoIndexSpec[]>(INDEXES_CACHE_KEY);
      if (cached && Array.isArray(cached)) {
        return cached;
      }
      const coll = this.messageModel.db.collection(collectionName);
      const indexes = (await coll.indexes()) as MongoIndexSpec[];
      await this.cache.set(INDEXES_CACHE_KEY, indexes, INDEXES_CACHE_TTL_MS);
      return indexes;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[getIndexes] error:', err);
      return [];
    }
  }

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

    const dbIndexes = await this.getIndexes('social_messages');
    const compoundReady = isCompoundMigrationReady(dbIndexes);

    const escapeRegExp = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
     * CODE
     * =============================== */
    if (Array.isArray((input as any).code) && (input as any).code.length) {
      result.match.code = {
        $regex: (input as any).code.join('|'),
      };
    }

    /* ===============================
     * FAVORITE (run early; when favorite, skip keywords/tags/ex_tags)
     * =============================== */
    if (
      Array.isArray(input.favoriteMessage) &&
      input.favoriteMessage.length < 2 &&
      email
    ) {
      const isFavorite = input.favoriteMessage.includes(FavoriteMessage.Favorite);

      // TODO: get user favorites from database (must return { favorites: [{ id: string }, ...] })
      const userFavData: any = { favorites: [] };

      const hasFavData =
        !_.isEmpty(userFavData) &&
        Array.isArray(userFavData.favorites) &&
        userFavData.favorites.length > 0;

      if (hasFavData) {
        const favIds = userFavData.favorites.map(
          (o: any) => new Types.ObjectId(o.id),
        );
        result.match._id = isFavorite ? { $in: favIds } : { $nin: favIds };
        if (isFavorite) {
          delete (input as any).keywords;
          delete (input as any).tags;
          delete (input as any).ex_tags;
        }
      }
    }

    /* ===============================
     * CHANNEL
     * =============================== */
    if (input.channel?.length) {
      result.match.channel = { $in: expandChannels(input.channel) };
    }

    /* ===============================
     * KEYWORDS (temp) + MONITOR COMBINATION
     * =============================== */
    let keywordClause: { $in: string[] } | null = null;
    if (Array.isArray(input.keywords) && input.keywords.length) {
      const noKeyword = input.keywords.includes('No Keyword');
      keywordClause = noKeyword ? { $in: [] } : { $in: input.keywords };
    }

    if ((input as any).monitor && Object.keys((input as any).monitor).length) {
      const condition = (input as any).condition || 'or';
      const monitorOrList = buildMonitorOr((input as any).monitor, '$in');

      if (monitorOrList.length) {
        const keywordPart = keywordClause ? { keywords: keywordClause } : null;
        if (condition === 'and') {
          result.match.$and = [
            ...(result.match.$and || []),
            keywordPart,
            { $or: monitorOrList },
          ].filter(Boolean);
        } else if (condition === 'keywordAndNotMonitor') {
          result.match.$and = [
            ...(result.match.$and || []),
            keywordPart,
            { $nor: monitorOrList },
          ].filter(Boolean);
        } else {
          result.match.$or = [keywordPart, { $or: monitorOrList }].filter(
            Boolean,
          );
        }
      }
    }

    /* ===============================
     * KEYWORD ONLY (no monitor)
     * =============================== */
    if (_.isEmpty((input as any).monitor) && keywordClause) {
      const condition = (input as any).condition || 'or';
      if (condition === 'and') {
        result.match.$and = [
          ...(result.match.$and || []),
          { keywords: keywordClause },
        ];
      } else {
        result.match.$or = [
          ...(Array.isArray(result.match.$or) ? result.match.$or : []),
          { keywords: keywordClause },
        ];
      }
    }

    /* ===============================
     * SIMPLE $in FIELDS
     * =============================== */
    for (const f of SIMPLE_IN_FIELDS) {
      if (Array.isArray((input as any)[f]) && (input as any)[f].length) {
        let values = (input as any)[f] as string[];
        if (['speakerType', 'intent'].includes(f)) {
          values = values.map((i) => (i === 'none' ? '' : i));
        }
        result.match[f] = { $in: values };
      }
    }

    /* ===============================
     * SENTIMENT
     * =============================== */
    if (Array.isArray((input as any).sentiment) && (input as any).sentiment.length) {
      result.match['content.sentiment'] = {
        $in: (input as any).sentiment,
      };
    }

    /* ===============================
     * SENT TO ALERT (filterBy)
     * =============================== */
    if (Array.isArray((input as any).filterBy) && (input as any).filterBy.length) {
      result.match['sendTo.alert'] = {
        $in: (input as any).filterBy,
      };
    }

    /* ===============================
     * POST FORMAT
     * =============================== */
    if (
      Array.isArray((input as any).postFormat) &&
      (input as any).postFormat.length
    ) {
      const postFormat = [...(input as any).postFormat];
      if (_.isEqual(postFormat, ['text'])) {
        result.match.postFormat = postFormat;
      } else {
        const isImage = postFormat.some((f: string) => f === 'image');
        if (isImage && !postFormat.includes('album')) {
          postFormat.push('album');
        }
        result.match.postFormat = { $in: postFormat };
      }
    }

    /* ===============================
     * TRACKING POST
     * =============================== */
    if (
      Array.isArray((input as any).trackingPost) &&
      (input as any).trackingPost.length
    ) {
      const trackingPost = (input as any).trackingPost;
      const isActiveTracking = trackingPost.some(
        (f: string) => f === 'activeTracking',
      );
      const nowIso = dayjs().toISOString();
      result.match.trackingPost = isActiveTracking
        ? { $gt: nowIso }
        : { $lt: nowIso };
    }

    /* ===============================
     * DETECTED BY (AI Detect)
     * =============================== */
    if (
      Array.isArray((input as any).detectedBy) &&
      (input as any).detectedBy.length
    ) {
      const detects = [{ ai_detect: { $in: (input as any).detectedBy } }];
      if (Array.isArray(result.match.$and) && result.match.$and.length) {
        result.match.$and.push({ $or: detects });
      } else {
        result.match.$and = [{ $or: detects }];
      }
    }

    /* ===============================
     * LANGUAGE FILTER
     * =============================== */
    if (
      Array.isArray((input as any).language) &&
      (input as any).language.length
    ) {
      const regexParts = (input as any).language
        .map((lang: string) => LANGUAGE_REGEX_MAP[String(lang).toLowerCase()])
        .filter(Boolean);

      if (regexParts.length) {
        const langRegex = regexParts.join('|');
        const langOr = LANGUAGE_SEARCH_FIELDS.map((field) => ({
          [field]: { $regex: langRegex, $options: 'i' },
        }));
        result.match.$and = [...(result.match.$and || []), { $or: langOr }];
      }
    }

    /* ===============================
     * TAG INCLUDE / EXCLUDE
     * =============================== */
    if (Array.isArray((input as any).tags) && (input as any).tags.length) {
      result.match.tags = { $in: (input as any).tags };
    }

    if (Array.isArray((input as any).ex_tags) && (input as any).ex_tags.length) {
      result.match.tags = {
        ...(result.match.tags || {}),
        $nin: (input as any).ex_tags,
      };
    }

    /* ===============================
     * STATUS MESSAGE (length < 2)
     * =============================== */
    if (
      Array.isArray((input as any).statusMessage) &&
      (input as any).statusMessage.length < 2
    ) {
      const isRead = (input as any).statusMessage.some(
        (f: string) => f === 'read',
      );
      result.match.statusMessage = isRead
        ? { $in: ['read'] }
        : { $nin: ['read'] };
    }

    /* ===============================
     * VISIBILITY (length < 2)
     * =============================== */
    if (
      Array.isArray((input as any).visibility) &&
      (input as any).visibility.length < 2
    ) {
      const hasHide = (input as any).visibility.some(
        (f: string) => f === 'hide',
      );
      result.match.visibility = hasHide
        ? { $in: ['hide'] }
        : { $nin: ['hide'] };
    }

    /* ===============================
     * ARR ID
     * =============================== */
    if (Array.isArray((input as any).arr_id) && (input as any).arr_id.length) {
      result.match._id = {
        $in: (input as any).arr_id.map(
          (id: string) => new Types.ObjectId(id),
        ),
      };
    }

    /* ===============================
     * RAW CONTENT (Always)
     * =============================== */
    result.match['rawContent.save_import'] = { $nin: [false] };

    /* ===============================
     * SEARCH (followers, domain, text)
     * =============================== */
    if (Array.isArray((input as any).search) && (input as any).search.length) {
      let searchArr: string[] = [...(input as any).search];
      const searchAndConditions: any[] = [];

      // Followers
      const followers = _.remove(searchArr, (item) =>
        String(item).startsWith('followers:'),
      );
      if (followers.length > 0) {
        const targetFollower = parseInt(
          followers[0].replace('followers:', ''),
          10,
        );
        if (!Number.isNaN(targetFollower)) {
          searchAndConditions.push({
            $or: [
              { 'content.user.followers_count': { $gte: targetFollower } },
              { 'content.from.followers_count': { $gte: targetFollower } },
              { 'content.user.edge_followed_by': { $gte: targetFollower } },
              {
                $expr: {
                  $gt: [
                    {
                      $toInt:
                        '$content.statisticsChannel.subscriberCount',
                    },
                    targetFollower,
                  ],
                },
              },
              { 'content.follower': { $gte: targetFollower } },
            ],
          });
        }
      }

      // Domains
      const domains = _.remove(searchArr, (item) =>
        String(item).startsWith('domain:'),
      );
      if (domains.length > 0) {
        searchAndConditions.push({
          $or: domains.map((d) => ({
            domain: {
              $regex: escapeRegExp(d.replace('domain:', '')),
              $options: 'i',
            },
          })),
        });
      }

      // Text search (AND, AND NOT, OR)
      if (searchArr.length > 0) {
        const AND = ' AND ';
        const AND_NOT = ' AND NOT ';
        const andSearch: any[] = [];
        const orSearch: string[] = [];

        searchArr.forEach((element) => {
          if (element.includes(AND) && !element.includes(AND_NOT)) {
            const arrText = element
              .split(AND)
              .map((t) => escapeRegExp(t.trim()));
            const fieldOrs = LANGUAGE_SEARCH_FIELDS.map((key) => ({
              $and: arrText.map((t) => ({
                [key]: { $regex: t, $options: 'i' },
              })),
            }));
            andSearch.push({ $or: fieldOrs });
          } else if (element.includes(AND_NOT)) {
            const arrText = element
              .split(AND_NOT)
              .map((t) => escapeRegExp(t.trim()));
            const fieldOrs = LANGUAGE_SEARCH_FIELDS.map((key) => ({
              $and: arrText.map((t, i) => {
                if (i === 1) {
                  return {
                    [key]: {
                      $not: { $regex: t, $options: 'i' },
                    },
                  };
                }
                return { [key]: { $regex: t, $options: 'i' } };
              }),
            }));
            andSearch.push({ $or: fieldOrs });
          } else {
            orSearch.push(escapeRegExp(element.trim()));
          }
        });

        const textSearchOrs: any[] = [];
        if (orSearch.length > 0) {
          const joinedOr = orSearch.join('|');
          LANGUAGE_SEARCH_FIELDS.forEach((key) => {
            textSearchOrs.push({
              [key]: { $regex: joinedOr, $options: 'i' },
            });
          });
        }

        if (textSearchOrs.length > 0 || andSearch.length > 0) {
          const finalSearchOr = [...textSearchOrs, ...andSearch];
          searchAndConditions.push({ $or: finalSearchOr });
        }
      }

      if (searchAndConditions.length > 0) {
        result.match.$and = [
          ...(result.match.$and || []),
          ...searchAndConditions,
        ];
      }
    }

    /* ===============================
     * ADVANCE SEARCH
     * =============================== */
    if (!_.isEmpty((input as any).advanceSearch)) {
      const advanceSearchMatch = genAdvanceSearchMatch(
        (input as any).advanceSearch,
      );

      if (!_.isEmpty(advanceSearchMatch.andList)) {
        result.match.$and = [
          ...(result.match.$and || []),
          ...advanceSearchMatch.andList,
        ];
      }

      if (!_.isEmpty(advanceSearchMatch.advanceSearchFields)) {
        (result as any).advanceSearchFields =
          advanceSearchMatch.advanceSearchFields;
      }

      if (!_.isEmpty(advanceSearchMatch.advanceSearchWord)) {
        result.match.advanceSearchWord = advanceSearchMatch.advanceSearchWord;
      }

      if (!_.isEmpty(advanceSearchMatch.advanceSearchAuthor)) {
        result.match.advanceSearchAuthor =
          advanceSearchMatch.advanceSearchAuthor;
      }
    }

    const _idIn = result.match._id && (result.match._id as any).$in;
    result.hint = _idIn
      ? { _id: 1 }
      : buildMongoHint(
          {
            sortBy: input.sortBy,
            monitor: (input as any).monitor,
            keywords: input.keywords,
          },
          dbIndexes,
          true,
        );

    return result;
  }
}

function genAdvanceSearchMatch(search: any) {
  const wordFields = [
    'content.message',
    'content.full_text',
    'content.content',
    'content.text',
    'content.title',
    'content.caption',
    'content.topic',
    'content.snippet.title',
    'content.snippet.description',
    'content.gcp.ocr',
    'center_data.ai.ocr',
    'ocr_text',
    'object_text',
  ];

  const authorFields = [
    'content.user.username',
    'content.pageName',
    'content.gcp.object.name',
    'center_data.profile.name',
    'center_data.profile.username',
    'content.from.name',
    'content.username',
    'content.user.name',
    'content.author',
    'content.snippet.channelTitle',
  ];

  const operatorMap: Record<string, string> = {
    '=': '$eq',
    '>': '$gt',
    '>=': '$gte',
    '<': '$lt',
    '<=': '$lte',
  };

  const escapeRegex = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let andList: any[] = [];
  const advanceSearchFields: any = { $addFields: {} };
  let advanceSearchWord: any = {};
  let advanceSearchAuthor: any = {};

  if (search.word) {
    const hasInclude =
      Array.isArray(search.word.include) && search.word.include.length > 0;
    const hasExclude =
      Array.isArray(search.word.exclude) && search.word.exclude.length > 0;

    if (hasInclude || hasExclude) {
      const concatWord = {
        $concat: wordFields.flatMap((field) => [
          {
            $ifNull: [
              {
                $cond: [
                  { $eq: [{ $type: `$${field}` }, 'string'] },
                  `$${field}`,
                  '',
                ],
              },
              '',
            ],
          },
          ' ',
        ]),
      };
      advanceSearchFields.$addFields.advanceSearchWord = concatWord;

      const include: string[] = search.word.include || [];
      const exclude: string[] = search.word.exclude || [];

      const regexParts: string[] = [];

      if (exclude.length > 0) {
        regexParts.push(
          `^${exclude
            .map((w) => `(?![\\s\\S]*${escapeRegex(w.trim())})`)
            .join('')}`,
        );
      }

      if (include.length > 0) {
        regexParts.push(
          `.*(${include
            .map((w) => escapeRegex(w.trim()))
            .join('|')})`,
        );
      }

      advanceSearchWord = { $regex: regexParts.join(''), $options: 'i' };
    }
  }

  if (search.author) {
    const hasInclude =
      Array.isArray(search.author.include) && search.author.include.length > 0;
    const hasExclude =
      Array.isArray(search.author.exclude) && search.author.exclude.length > 0;

    if (hasInclude || hasExclude) {
      const concatAuthor = {
        $concat: authorFields.flatMap((field) => [
          {
            $ifNull: [
              {
                $cond: [
                  { $eq: [{ $type: `$${field}` }, 'string'] },
                  `$${field}`,
                  '',
                ],
              },
              '',
            ],
          },
          ' ',
        ]),
      };
      advanceSearchFields.$addFields.advanceSearchAuthor = concatAuthor;

      const include: string[] = search.author.include || [];
      const exclude: string[] = search.author.exclude || [];

      const regexParts: string[] = [];

      if (exclude.length > 0) {
        regexParts.push(
          `^${exclude
            .map((w) => `(?![\\s\\S]*${escapeRegex(w.trim())})`)
            .join('')}`,
        );
      }

      if (include.length > 0) {
        regexParts.push(
          `.*(${include
            .map((w) => escapeRegex(w.trim()))
            .join('|')})`,
        );
      }

      advanceSearchAuthor = { $regex: regexParts.join(''), $options: 'i' };
    }
  }

  if (Array.isArray(search.is) && search.is.length > 0) {
    andList.push({ channel: { $regex: search.is.join('|') } });
  }

  if (search.engagement && search.engagement.operator && search.engagement.value) {
    const op = operatorMap[search.engagement.operator];
    if (op) {
      andList.push({
        totalEngagement: { [op]: search.engagement.value },
      });
    }
  }

  if (search.views && search.views.operator && search.views.value) {
    const op = operatorMap[search.views.operator];
    if (op) {
      andList.push({
        totalView: { [op]: search.views.value },
      });
    }
  }

  return {
    andList,
    advanceSearchFields,
    advanceSearchWord,
    advanceSearchAuthor,
  };
}


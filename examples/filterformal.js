const _ = require('lodash')
const moment = require('moment')
const { filterFormal } = require('./funcLibrary')
const mongodb = require('./mongodb')
const mongoose = require('mongoose')

/* ===============================
 * CHANNEL GROUP MAPPING
 * =============================== */
const CHANNEL_GROUPS = {
  facebook: ['facebook-post', 'facebook-comment', 'facebook-subcomment'],
  facebookgroup: ['facebookgroup-post', 'facebookgroup-comment', 'facebookgroup-subcomment'],
  twitter: ['twitter-tweet', 'twitter-reply', 'twitter-retweet', 'twitter-quote'],
  tiktok: ['tiktok-post', 'tiktok-comment', 'tiktok-subcomment'],
  youtube: ['youtube', 'youtube-post', 'youtube-comment'],
  instagram: ['instagram', 'instagram-comment'],
  pantip: ['pantip-post', 'pantip-comment'],
  blockdit: ['blockdit-post'],
  website: ['website', 'website-post'],
  webboard: ['webboard-post', 'webboard-comment'],
  newspaper: ['newspaper'],
  magazine: ['magazine'],
  radio: ['radio'],
  television: ['television'],
}

const SORT_FIELD_MAP = {
  publisheddate: 'publishedAtUnix',
  totalEngagement: 'totalEngagement',
  totalView: 'totalView',
  follower: 'follower',
}

const LANGUAGE_REGEX_MAP = {
  th: '[ก-ฮ]',
  tha: '[ก-ฮ]',
  en: '[A-z]',
  eng: '[A-z]',
  mm: '[က-ဪ]',
  mya: '[က-ဪ]',
  bur: '[က-ဪ]',
  lo: '[ກ-ຮ]',
  lao: '[ກ-ຮ]',
  km: '[ក-ឳ]',
  khm: '[ក-ឳ]',
  vi: '[À-ỹ]',
  vie: '[À-ỹ]',
  zh: '[\\u4e00-\\u9fa5]',
  zho: '[\\u4e00-\\u9fa5]',
  ko: '[가-힣]',
  kor: '[가-힣]',
  ja: '[ぁ-ゟァ-ヿㇰ-ㇿ一-龯]',
  jpn: '[ぁ-ゟァ-ヿㇰ-ㇿ一-龯]',
}

const SEARCH_TEXT_FIELDS = [
  'content.from.name',
  'content.user.name',
  'content.user.username',
  'content.username',
  'content.message',
  'content.full_text',
  'content.content',
  'content.pageName',
  'content.text',
  'content.title',
  'content.caption',
  'content.topic',
  'content.snippet.title',
  'content.snippet.channelTitle',
  'content.snippet.description',
  'content.author',
  'content.gcp.ocr',
  'center_data.ai.ocr',
  'content.gcp.object.name',
  'ocr_text',
  'object_text',
  'center_data.topic',
  'center_data.message',
]

const DATE_FILTER_GROUP = {
  $dateToString: {
    format: '%Y-%m-%d',
    date: { $toDate: '$publishedAtUnix' },
    timezone: '+07:00',
  },
}

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/* ===============================
 * MAIN
 * =============================== */
async function filterFormalV2(findOrWrapper = {}, useSort = false) {
  const raw = _.cloneDeep(findOrWrapper)
  const email = raw?.email || ''

  const mongoIndexes = await mongodb.getIndexesMongo('social_messages')

  // ✅ รองรับ wrapper: { find, startDate, endDate }
  const input = raw?.find && typeof raw.find === 'object' ? _.cloneDeep(raw.find) : raw
  const result = {
    match: {},
    sort: {},
    temp_keyword: { $exists: true },
    hint: {},
  }

  /* ===============================
   * DATE RANGE
   * =============================== */
  if (raw.startDate && raw.endDate) {
    const compoundReady = isCompoundMigrationReady(mongoIndexes)
    const start = moment(raw.startDate).second(0)
    const end = moment(raw.endDate).second(59)
    if (!compoundReady) {
      result.match.publisheddate = {
        $gte: start.format(),
        $lte: end.format(),
      }
    } else {
      result.match.publishedAtUnix = {
        $gte: start.toDate(),
        $lte: end.toDate(),
      }
    }
  }

  /* ===============================
   * SORT
   * =============================== */
  if (input.sortBy) {
    const [rawKey, order] = String(input.sortBy).split('-')
    const sortKey = SORT_FIELD_MAP[rawKey] || rawKey
    const sortOrder = order === 'asc' ? 1 : -1
    result.sort = { [sortKey]: sortOrder }
  } else {
    result.sort = { publishedAtUnix: -1 }
  }
  delete input.sortBy

  /* ===============================
   * CODE
   * =============================== */
  if (Array.isArray(input.code) && input.code.length) {
    result.match.code = { $regex: input.code.join('|') }
  }
  delete input.code

  /* ===============================
   * Favorite
   * =============================== */
  if (Array.isArray(input.favoriteMessage) && input.favoriteMessage.length < 2) {
    const favorite = input.favoriteMessage.some((f) => f === 'favorite')

    const data = await mongodb.findOne('socialUserFavorites', 'favoriteUserSchema', { username: email })

    if (!_.isEmpty(data)) {
      if (favorite) {
        result.match._id = { $in: data.favorites.map((o) => mongoose.Types.ObjectId(o.id)) }
        delete input.keywords
        delete input.tags
        delete input.ex_tags
      } else {
        result.match._id = { $nin: data.favorites.map((o) => mongoose.Types.ObjectId(o.id)) }
      }
    }
  }
  delete input.favoriteMessage

  /* ===============================
   * CHANNEL (non-monitor)
   * =============================== */
  if (Array.isArray(input.channel) && input.channel.length) {
    result.match.channel = { $in: expandChannels(input.channel) }
  }
  delete input.channel

  if (Array.isArray(input.keywords) && input.keywords.length) {
    const noKeyword = input.keywords.includes('No Keyword')
    result.keywords = noKeyword ? { $in: [] } : { $in: input.keywords }
  }

  /* ===============================
   * KEYWORD + MONITOR COMBINATION
   * =============================== */
  if (input.monitor && Object.keys(input.monitor).length) {
    const condition = input.condition || 'or'
    const keywordClause = result.keywords ? { keywords: result.keywords } : null

    let monitorOperator = '$in'
    const monitorOrList = buildMonitorOr(input.monitor, monitorOperator)

    if (monitorOrList.length) {
      if (condition === 'and') {
        result.match.$and = [...(result.match.$and || []), keywordClause, { $or: monitorOrList }].filter(Boolean)
      } else if (condition === 'keywordAndNotMonitor') {
        result.match.$and = [...(result.match.$and || []), keywordClause, { $nor: monitorOrList }].filter(Boolean)
      } else if (condition === 'or') {
        result.match.$or = [keywordClause, { $or: monitorOrList }].filter(Boolean)
      }
    }
  }

  /* ===============================
   * KEYWORD ONLY
   * =============================== */
  if (_.isEmpty(input.monitor) && !_.isEmpty(result.keywords)) {
    const condition = input.condition || 'or'
    if (condition === 'and') {
      result.match.$and = [...(result.match.$and || []), { keywords: result.keywords }]
    } else {
      result.match.$or = [{ keywords: result.keywords }]
    }
  }
  delete result.keywords
  delete input.monitor
  delete input.condition

  /* ===============================
   * RAW CONTENT (always)
   * =============================== */
  result.match['rawContent.save_import'] = { $nin: [false] }

  /* ===============================
   * 🔥 SEARCH (Optimized from V1) 🔥
   * =============================== */
  if (Array.isArray(input.search) && input.search.length > 0) {
    let searchArr = [...input.search]
    const searchAndConditions = []

    // 1. จัดการ Followers
    let followers = _.remove(searchArr, (item) => String(item).startsWith('followers:'))
    if (followers.length > 0) {
      const targetFollower = parseInt(followers[0].replace('followers:', ''), 10)
      if (!isNaN(targetFollower)) {
        searchAndConditions.push({
          $or: [
            { 'content.user.followers_count': { $gte: targetFollower } },
            { 'content.from.followers_count': { $gte: targetFollower } },
            { 'content.user.edge_followed_by': { $gte: targetFollower } },
            { $expr: { $gt: [{ $toInt: '$content.statisticsChannel.subscriberCount' }, targetFollower] } },
            { 'content.follower': { $gte: targetFollower } },
          ],
        })
      }
    }

    // 2. จัดการ Domains
    let domains = _.remove(searchArr, (item) => String(item).startsWith('domain:'))
    if (domains.length > 0) {
      searchAndConditions.push({
        $or: domains.map((d) => ({ domain: { $regex: escapeRegExp(d.replace('domain:', '')), $options: 'i' } })),
      })
    }

    // 3. จัดการ Text Search (AND, AND NOT, OR)
    if (searchArr.length > 0) {
      const _and = ' AND '
      const _and_not = ' AND NOT '
      const and_search = []
      const or_search = []

      searchArr.forEach((element) => {
        if (element.includes(_and) && !element.includes(_and_not)) {
          let arr_text = element.split(_and).map((t) => escapeRegExp(t.trim()))
          const fieldOrs = SEARCH_TEXT_FIELDS.map((key) => ({
            $and: arr_text.map((t) => ({ [key]: { $regex: t, $options: 'i' } })),
          }))
          and_search.push({ $or: fieldOrs })
        } else if (element.includes(_and_not)) {
          let arr_text = element.split(_and_not).map((t) => escapeRegExp(t.trim()))
          const fieldOrs = SEARCH_TEXT_FIELDS.map((key) => ({
            $and: arr_text.map((t, i) => {
              if (i === 1) return { [key]: { $not: { $regex: t, $options: 'i' } } }
              return { [key]: { $regex: t, $options: 'i' } }
            }),
          }))
          and_search.push({ $or: fieldOrs })
        } else {
          or_search.push(escapeRegExp(element.trim()))
        }
      })

      const textSearchOrs = []
      // นำคำที่เป็น OR มารวมเป็น Regex เดียวกันเพื่อให้ทำงานเร็วขึ้น
      if (or_search.length > 0) {
        const joinedOr = or_search.join('|')
        SEARCH_TEXT_FIELDS.forEach((key) => {
          textSearchOrs.push({ [key]: { $regex: joinedOr, $options: 'i' } })
        })
      }

      if (textSearchOrs.length > 0 || and_search.length > 0) {
        const finalSearchOr = [...textSearchOrs, ...and_search]
        searchAndConditions.push({ $or: finalSearchOr })
      }
    }

    // นำเงื่อนไขการค้นหาทั้งหมดเข้าไปผูกกับ match.$and อย่างปลอดภัย
    if (searchAndConditions.length > 0) {
      result.match.$and = [...(result.match.$and || []), ...searchAndConditions]
    }
  }
  delete input.search

  /* ===============================
   * Advance Search
   * =============================== */
  if (!_.isEmpty(input.advanceSearch)) {
    const advanceSearchMatch = genAdvanceSearchMatch(input.advanceSearch)
    if (!_.isEmpty(advanceSearchMatch.andList)) {
      result.match.$and = [...(result.match.$and || []), ...advanceSearchMatch.andList]
    }
    if (!_.isEmpty(advanceSearchMatch.advanceSearchFields)) {
      result.advanceSearchFields = advanceSearchMatch.advanceSearchFields
    }
    if (!_.isEmpty(advanceSearchMatch.advanceSearchWord)) {
      result.match.advanceSearchWord = advanceSearchMatch.advanceSearchWord
    }
    if (!_.isEmpty(advanceSearchMatch.advanceSearchAuthor)) {
      result.match.advanceSearchAuthor = advanceSearchMatch.advanceSearchAuthor
    }
  }
  delete input.advanceSearch

  /* ===============================
   * Arr Id
   * =============================== */
  if (!_.isEmpty(input.arr_id)) {
    result.match._id = { $in: input.arr_id.map((id) => mongoose.Types.ObjectId(id)) }
  }
  delete input.arr_id

  /* ===============================
   * Sentiment
   * =============================== */
  if (Array.isArray(input.sentiment) && input.sentiment.length) {
    result.match['content.sentiment'] = { $in: input.sentiment }
  }
  delete input.sentiment

  /* ===============================
   * Sent to Alert
   * =============================== */
  if (Array.isArray(input.filterBy) && input.filterBy.length) {
    result.match['sendTo.alert'] = { $in: input.filterBy }
  }
  delete input.filterBy

  /* ===============================
   * Post Format
   * =============================== */
  if (Array.isArray(input.postFormat) && input.postFormat.length) {
    if (_.isEqual(input.postFormat, ['text'])) {
      result.match.postFormat = input.postFormat
    } else {
      const isImage = input.postFormat.some((f) => f === 'image')
      if (isImage) {
        input.postFormat.push('album')
      }
      result.match.postFormat = { $in: input.postFormat }
    }
  }
  delete input.postFormat

  /* ===============================
   * Tracking Post
   * =============================== */
  if (Array.isArray(input.trackingPost) && input.trackingPost.length) {
    const isActiveTracking = input.trackingPost.some((f) => f === 'activeTracking')
    if (isActiveTracking) {
      result.match.trackingPost = { $gt: moment().format('YYYY-MM-DDTHH:mm:ss.SSSSZ') }
    } else {
      result.match.trackingPost = { $lt: moment().format('YYYY-MM-DDTHH:mm:ss.SSSSZ') }
    }
  }
  delete input.trackingPost

  /* ===============================
   * Detect By
   * =============================== */

  if (Array.isArray(input.detectedBy) && input.detectedBy.length) {
    const detects = [{ ai_detect: { $in: input.detectedBy } }]
    if (result.match.$and && result.match.$and.length > 0) {
      result.match['$and'].push({ $or: detects })
    } else {
      result.match['$and'] = [{ $or: detects }]
    }
  }
  delete input.detectedBy

  /* ===============================
   * LANGUAGE FILTER
   * =============================== */
  if (Array.isArray(input.language) && input.language.length) {
    const regexParts = input.language.map((lang) => LANGUAGE_REGEX_MAP[String(lang).toLowerCase()]).filter(Boolean)
    if (regexParts.length) {
      const langRegex = regexParts.join('|')
      const langOr = SEARCH_TEXT_FIELDS.map((field) => ({
        [field]: { $regex: langRegex, $options: 'i' },
      }))
      result.match.$and = [...(result.match.$and || []), { $or: langOr }]
    }
    delete input.language
  }

  /* ===============================
   * TAG Include
   * =============================== */
  if (Array.isArray(input.tags) && input.tags.length) {
    result.match.tags = { $in: input.tags }
    delete input.tags
  }

  /* ===============================
   * TAG Exclude
   * =============================== */
  if (Array.isArray(input.ex_tags) && input.ex_tags.length) {
    result.match.tags = { ...result.match.tags, $nin: input.ex_tags }
    delete input.ex_tags
  }

  /* ===============================
   * Status Message
   * =============================== */
  if (Array.isArray(input.statusMessage) && input.statusMessage.length < 2) {
    const isRead = input.statusMessage.some((f) => f == 'read')
    result.match.statusMessage = isRead ? { $in: ['read'] } : { $nin: ['read'] }
    delete input.statusMessage
  }

  /* ===============================
   * Visibility
   * =============================== */
  if (Array.isArray(input.visibility) && input.visibility.length < 2) {
    const isShow = input.visibility.some((f) => f == 'hide')
    result.match.visibility = isShow ? { $in: ['hide'] } : { $nin: ['hide'] }
    delete input.visibility
  }

  /* ===============================
   * SIMPLE $in FIELDS
   * =============================== */
  const simpleInFields = [
    'sentiments',
    'source',
    'provinceName',
    'speakerType',
    'intent',
    'tagsPr',
    'tagsRpt',
    'prnews',
    'prSentiment',
    'rptSentiment',
    'prStatusMessage',
    'rptStatusMessage',
    'prVisibility',
    'rptVisibility',
  ]

  for (const f of simpleInFields) {
    if (Array.isArray(input[f]) && input[f].length) {
      if (['speakerType', 'intent'].includes(f)) {
        input[f] = input[f].map((i) => (i === 'none' ? '' : i))
      }
      result.match[f] = { $in: input[f] }
    }
    delete input[f]
  }
  const _idIn = result.match._id && result.match._id?.$in ? true : false
  const hint = _idIn ? { _id: 1 } : buildMongoHint(findOrWrapper, mongoIndexes, useSort)

  // console.log(`hint`, hint)
  if (hint) {
    result.hint = hint
  }

  return result
}

function hasExactIndex(indexes, keyPattern) {
  return indexes.some((idx) => {
    const keys = Object.keys(keyPattern)
    if (keys.length !== Object.keys(idx.key).length) return false

    return keys.every((k) => idx.key[k] === keyPattern[k])
  })
}

function isCompoundMigrationReady(indexes) {
  const REQUIRED_INDEXES = [
    { publishedAtUnix: 1 },
    { publishedAtUnix: -1 },
    { publishedAtUnix: -1, account_ids: 1 },
    { publishedAtUnix: 1, account_ids: 1 },
    { publishedAtUnix: -1, keywords: 1 },
    { publishedAtUnix: 1, keywords: 1 },
  ]

  return REQUIRED_INDEXES.every((pattern) => hasExactIndex(indexes, pattern))
}

function buildMonitorOr(monitor, operator = '$in') {
  const orList = []

  for (const [platform, accounts] of Object.entries(monitor)) {
    if (!CHANNEL_GROUPS[platform.toLowerCase()] || !accounts?.length) continue

    orList.push({
      channel: { $in: CHANNEL_GROUPS[platform.toLowerCase()] },
      account_ids: {
        [operator]: accounts.map(String),
      },
    })
  }

  return orList
}

function expandChannels(inputChannels = []) {
  const out = []

  for (const raw of inputChannels) {
    if (!raw) continue
    const ch = String(raw).toLowerCase()

    // ---------- CASE 1: wildcard (*) ----------
    // facebook*  => ทุก group ที่ขึ้นต้นด้วย facebook
    if (ch.endsWith('*')) {
      const prefix = ch.slice(0, -1) // facebook
      for (const [groupKey, channels] of Object.entries(CHANNEL_GROUPS)) {
        if (groupKey.startsWith(prefix)) {
          out.push(...channels)
        }
      }
      continue
    }

    // ---------- CASE 2: dash (-) ----------
    // facebook- / facebookgroup-
    if (ch.endsWith('-')) {
      const key = ch.slice(0, -1)
      if (CHANNEL_GROUPS[key]) {
        out.push(...CHANNEL_GROUPS[key])
      }
      continue
    }

    // ---------- CASE 3: direct key ----------
    if (CHANNEL_GROUPS[ch]) {
      out.push(...CHANNEL_GROUPS[ch])
      continue
    }

    // ---------- CASE 4: already full channel ----------
    out.push(raw)
  }

  return _.uniq(out)
}

function genAdvanceSearchMatch(search) {
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
  ]
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
  ]
  const operatorMap = {
    '=': '$eq',
    '>': '$gt',
    '>=': '$gte',
    '<': '$lt',
    '<=': '$lte',
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  let andList = []
  let advanceSearchFields = { $addFields: {} }
  let advanceSearchWord = {}
  let advanceSearchAuthor = {}
  if (search.word) {
    if (
      (search.word.include && Array.isArray(search.word.include) && search.word.include.length > 0) ||
      (search.word.exclude && Array.isArray(search.word.exclude) && search.word.exclude.length > 0)
    ) {
      const concatWord = {
        $concat: wordFields.flatMap((field) => [
          {
            $ifNull: [{ $cond: [{ $eq: [{ $type: `$${field}` }, 'string'] }, `$${field}`, ''] }, ''],
          },
          ' ',
        ]),
      }
      advanceSearchFields.$addFields.advanceSearchWord = concatWord

      const include = search.word.include || []
      const exclude = search.word.exclude || []

      let regexParts = []

      if (exclude.length > 0) {
        regexParts.push(`^${exclude.map((w) => `(?![\\s\\S]*${escapeRegex(w.trim())})`).join('')}`)
      }

      if (include.length > 0) {
        regexParts.push(`.*(${include.map((w) => escapeRegex(w.trim())).join('|')})`)
      }

      advanceSearchWord = { $regex: regexParts.join(''), $options: 'i' }
    }
  }
  if (search.author) {
    if (
      (search.author.include && Array.isArray(search.author.include) && search.author.include.length > 0) ||
      (search.author.exclude && Array.isArray(search.author.exclude) && search.author.exclude.length > 0)
    ) {
      const concatAuthor = {
        $concat: authorFields.flatMap((field) => [
          {
            $ifNull: [{ $cond: [{ $eq: [{ $type: `$${field}` }, 'string'] }, `$${field}`, ''] }, ''],
          },
          ' ',
        ]),
      }
      advanceSearchFields.$addFields.advanceSearchAuthor = concatAuthor

      const include = search.author.include || []
      const exclude = search.author.exclude || []

      let regexParts = []

      if (exclude.length > 0) {
        regexParts.push(`^${exclude.map((w) => `(?![\\s\\S]*${escapeRegex(w.trim())})`).join('')}`)
      }

      if (include.length > 0) {
        regexParts.push(`.*(${include.map((w) => escapeRegex(w.trim())).join('|')})`)
      }

      advanceSearchAuthor = { $regex: regexParts.join(''), $options: 'i' }
    }
  }
  if (search.is && Array.isArray(search.is) && search.is.length > 0) {
    andList.push({ channel: { $regex: search.is.join('|') } })
  }
  if (search.engagement && search.engagement.operator && search.engagement.value) {
    andList.push({ totalEngagement: { [operatorMap[search.engagement.operator]]: search.engagement.value } })
  }
  if (search.views && search.views.operator && search.views.value) {
    andList.push({ totalView: { [operatorMap[search.views.operator]]: search.views.value } })
  }
  return { andList, advanceSearchFields, advanceSearchWord, advanceSearchAuthor }
}

function buildMongoHint(input, mongoIndexes, useSort) {
  const sortBy = input.find?.sortBy || 'publisheddate-desc'
  const sortDesc = sortBy === 'publisheddate-desc'
  const sortDir = sortDesc && useSort ? -1 : 1

  const hasMonitor = Object.values(input.find?.monitor || {}).some((arr) => Array.isArray(arr) && arr.length > 0)

  const hasKeyword = Array.isArray(input.find?.keywords) && input.find?.keywords.length > 0

  // 🔒 GATE: ถ้า compound ยังไม่ครบ → fallback อย่างเดียว

  const compoundReady = isCompoundMigrationReady(mongoIndexes)

  if (!compoundReady) {
    // ใช้ของเดิมระหว่าง migrate
    return { publisheddate: 1 }
    // return { publisheddate: sortDir }
  }

  if (hasKeyword) {
    return { publishedAtUnix: sortDir, keywords: 1 }
  }

  // ✅ MIGRATED PATH
  if (hasMonitor) {
    return { publishedAtUnix: sortDir, account_ids: 1 }
  }

  return { publishedAtUnix: sortDir }
}

module.exports = {
  filterFormalV2,
  CHANNEL_GROUPS,
  expandChannels,
  buildMonitorOr,
  DATE_FILTER_GROUP,
  genAdvanceSearchMatch,
  buildMongoHint,
}

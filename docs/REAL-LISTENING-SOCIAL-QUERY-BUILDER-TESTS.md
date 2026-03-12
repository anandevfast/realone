# Real Listening – Social Query Builder Unit Tests

Unit tests for `SocialQueryBuilderService.buildQuery()` in the Real Listening module. Coverage is aligned with **FilterQueryDTO** and the MongoDB `match` / `sort` / `hint` output.

- **Test file:** `src/modules/real-listening/domain/services/social-query-builder.service.spec.ts`
- **Service:** `src/modules/real-listening/domain/services/social-query-builder.service.ts`
- **DTO:** `src/modules/real-listening/domain/filter-query.dto.ts`

---

## How to run

```bash
npm test -- social-query-builder.service.spec
# or
npx jest social-query-builder.service.spec.ts --no-coverage
```

---

## Test setup

- **BASE_DTO:** `startDate`, `endDate` (required for date range in `match`).
- **buildService(indexes?):** Creates the service with mocked Mongoose model and cache. Default `indexes` = compound-ready (6 indexes); pass `[]` to simulate legacy DB (no compound indexes).
- All tests use `buildQuery(dto, email?)` and assert on `result.match`, `result.sort`, `result.hint`, and `result.advanceSearchFields` where relevant.

---

## Coverage by FilterQueryDTO field

| DTO field | Test coverage | Result shape |
|-----------|----------------|--------------|
| **startDate, endDate** | Date range with/without compound indexes | `match.publishedAtUnix` or `match.publisheddate` with `$gte` / `$lte` (Date) |
| **sortBy** | Default, asc/desc, totalEngagement, totalView, follower | `result.sort` e.g. `{ publishedAtUnix: -1 }`, `{ totalEngagement: -1 }` |
| **code** | Array of codes | `match.code` = `{ $regex: 'a|b' }` |
| **channel** | Single/multiple, expansion (e.g. twitter → twitter-tweet, …) | `match.channel` = `{ $in: [...] }` |
| **keywords** | Only keywords; with condition `or` / `and`; "No Keyword" | `match.$or` or `match.$and` with `keywords: { $in }` |
| **tags** | Include only | `match.tags` = `{ $in }` |
| **ex_tags** | Exclude only; tags + ex_tags combined | `match.tags` = `{ $nin }` or `{ $in, $nin }` |
| **sentiment** | Array | `match['content.sentiment']` = `{ $in }` |
| **statusMessage** | `["read"]`, `["unread"]`, length ≥ 2 (no filter) | `match.statusMessage` = `{ $in: ['read'] }` or `{ $nin: ['read'] }` or undefined |
| **visibility** | `["hide"]`, `["show"]`, length ≥ 2 (no filter) | `match.visibility` = `{ $in: ['hide'] }` or `{ $nin: ['hide'] }` or undefined |
| **speakerType** | Array; `"none"` → `""` | `match.speakerType` = `{ $in }` |
| **intent** | Array; `"none"` → `""` | `match.intent` = `{ $in }` |
| **filterBy** | Array | `match['sendTo.alert']` = `{ $in }` |
| **postFormat** | `["text"]`; image/video (adds album) | `match.postFormat` = array or `{ $in }` |
| **trackingPost** | activeTracking / stoppedTracking | `match.trackingPost` = `{ $gt }` or `{ $lt }` (ISO string) |
| **detectedBy** | Array (e.g. logo, ocr) | `match.$and` with `$or` containing `ai_detect: { $in }` |
| **language** | Array (e.g. th, en) | `match.$and` with `$or` of regex conditions |
| **arr_id** | Array of ObjectId strings | `match._id` = `{ $in: [ObjectId, ...] }` |
| **monitor** | e.g. `{ twitter: ['acc1'] }` with keywords | `match.$or` or `match.$and` + monitor `$or` / `$nor` |
| **condition** | `'and'` / `'keywordAndNotMonitor'` (service uses string) | Chooses `$and` vs `$or`; with monitor can add `$nor` |
| **advanceSearch** | `word: { include, exclude }` | `result.advanceSearchFields`, `match.advanceSearchWord` with `$regex` |
| **favoriteMessage** | `["favorite"]` + email; no user favorites in mock | `match._id` not set (no fav data) |
| **email** | Used only for favorite path | No direct match field; affects favorite logic only |

**Note:** `metric` and `resultBy` from FilterQueryDTO are not used inside `buildQuery`. `metric` is handled by `buildEngagementStage()` in `aggregation.util.ts` and applied directly in `AnalyticsRepository`. Tests do not assert on them.

---

## Hint logic (MongoDB index hint)

| Scenario | `result.hint` |
|----------|----------------|
| `arr_id` provided | `{ _id: 1 }` |
| Keywords only, compound indexes ready | `{ publishedAtUnix: ±1, keywords: 1 }` (direction from sortBy) |
| Monitor only, compound ready | `{ publishedAtUnix: ±1, account_ids: 1 }` |
| No keywords/monitor/arr_id, compound ready | `{ publishedAtUnix: ±1 }` |
| Compound indexes **not** ready | `{ publisheddate: 1 }` (legacy) |

---

## Always present in match

- `match['rawContent.save_import']` = `{ $nin: [false] }` in every build.

---

## Condition handling

The service compares `condition` to the strings `'and'` and `'keywordAndNotMonitor'`. FilterQueryDTO declares `condition: ConditionTemplate[]`; in tests we pass `condition: 'and'` or `'keywordAndNotMonitor'` as needed to hit the correct branch.

---

## metric → buildEngagementStage

The `metric` field (enum `Metric`) is **not** processed inside `buildQuery()`. It is handled by `buildEngagementStage(metric?)` in `aggregation.util.ts`, which is called directly by `AnalyticsRepository.getSeriesData()` to inject a `$addFields` stage into the MongoDB pipeline.

| `metric` value | `$addFields` stage injected |
|----------------|-----------------------------|
| `undefined`, `message`, `mention`, `view` | `{ engagement: 1 }` |
| `engagement` | `{ engagement: { $ifNull: ['$totalEngagement', 0] } }` |
| `engagement_view` | `{ engagement: { $add: [{ $ifNull: ['$totalEngagement', 0] }, { $ifNull: ['$totalView', 0] }] } }` |

---

## MonitorDTO – typed object tests

After `monitor` was migrated from `(input as any).monitor` to a typed `MonitorDTO` field, 4 additional test cases were added to cover the new typed path.

| Test case | Input | Expected |
|-----------|-------|----------|
| Multi-platform MonitorDTO (no condition) | `monitor: { pantip, instagram, facebook }` | `match.$or` contains inner `$or` with account_ids for all 3 platforms |
| MonitorDTO with `condition: 'and'` | `monitor: { youtube }` + `keywords` | `match.$and` contains a `$or` for monitor accounts |
| MonitorDTO with all-empty arrays | `monitor: { twitter: [], facebook: [] }` + `keywords` | No monitor `$or` inside `match.$or` (keyword-only branch) |
| No monitor, no keywords | base DTO only | `match.$or` and `match.$and` are both undefined |

---

## Total tests

**49** test cases covering date range, sort, code, channel, keywords, tags, ex_tags, sentiment, statusMessage, visibility, speakerType, intent, filterBy, postFormat, trackingPost, detectedBy, language, arr_id, monitor+condition, MonitorDTO typed object (multi-platform, condition and, empty arrays, no monitor), hint rules, rawContent.save_import, favoriteMessage (no fav data), and advanceSearch (word include/exclude).

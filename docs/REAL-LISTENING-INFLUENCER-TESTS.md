# Real Listening – Influencer Unit Tests

Unit tests for the Influencer feature in the Real Listening module. Coverage focuses on:

- The **top influencer summary** logic in `InfluencerService` (author/site counts, averages, top values).
- The **query response shape** that combines chart data with `topInfluencer`.

- **Test file:** `src/modules/real-listening/features/influencer/influencer.service.spec.ts`
- **Service:** `src/modules/real-listening/features/influencer/influencer.service.ts`
- **Repository:** `src/modules/real-listening/infrastructure/repositories/influencer.repository.ts`

---

## How to run

```bash
npm test -- influencer.service.spec
# or
npx jest influencer.service.spec.ts --no-coverage
```

---

## Test setup

- **buildService(mockData):** creates `InfluencerService` with a mocked `InfluencerRepository`:
  - `getGroupedData()` returns `mockData.grouped` (or throws when `throwOn === 'grouped'`).
  - `getTopInfluencer()` returns `mockData.topInfluencer` (or throws when `throwOn === 'top'`).
- **BASE_DTO:** provides minimal required fields for the Influencer filters:
  - `startDate`, `endDate`, `condition`, `email`.

All tests call either the private `buildTopInfluencer(raw)` helper (via type cast) or the public `query(dto)` method and assert on the resulting summary/shape.

---

## TopInfluencer summary coverage

The private helper `buildTopInfluencer(raw)` is the core of the new API shape. It:

- Sorts authors by `engagement`, `follower`, then `post` (all descending).
- Computes:
  - `uniqueAuthor` – number of unique authors (excluding `_id === 'null'`).
  - `uniqueSite` – number of unique `domain` values.
  - `averageMentionAuthor` – total `post` divided by `uniqueAuthor` (rounded to 2 decimals).
  - `averageMentionSite` – total `post` divided by `uniqueSite` (rounded to 2 decimals).
- Builds `values` – top 100 authors after sorting, excluding `_id === 'null'`.

### Test cases

| Case | Input | Expected behaviour |
|------|-------|--------------------|
| **Normal multi-author, multi-site** | 3 authors, 2 sites, different `post`/`engagement`/`follower` | `uniqueAuthor = 3`, `uniqueSite = 2`, averages use sum of `post`, `values` length = 3, first item is the author with highest engagement |
| **Author with `_id === 'null'`** | Mix of valid author + a `_id: 'null'` row | `uniqueAuthor` ignores the `'null'` row, `values` array does not contain `_id === 'null'` |
| **Empty input** | `raw = []` | `uniqueAuthor = 0`, `uniqueSite = 0`, both averages are `0` (no `NaN`), `values = []` |
| **More than 100 authors** | 120 authors with increasing `engagement` | `values.length === 100`, first element has the maximum `engagement` across all authors |

These cases are designed to catch:

- Division-by-zero bugs (averages becoming `NaN` or `Infinity`).
- Forgotten filtering of `_id === 'null'` authors.
- Incorrect sorting order (wrong “top 100” authors).

---

## InfluencerService.query() coverage

`InfluencerService.query(dto)` orchestrates:

1. Fetching grouped influencer metrics via `InfluencerRepository.getGroupedData(dto)`.
2. Fetching raw top influencer records via `InfluencerRepository.getTopInfluencer(dto)`.
3. Converting raw top influencer data into the canonical summary:

```ts
topInfluencer: {
  uniqueAuthor: number;
  uniqueSite: number;
  averageMentionAuthor: number;
  averageMentionSite: number;
  values: Array<{
    _id: string;
    channel: string;
    name: string;
    pic_profile: string | null;
    follower: number;
    subUrl: string | null;
    post: number;
    engagement: number;
    domain: string | null;
  }>;
}
```

### Test cases

| Case | DTO | Repository mocks | Expected behaviour |
|------|-----|------------------|--------------------|
| **All charts + topInfluencer** | `chartName` **not** provided | `getGroupedData` → `[]`, `getTopInfluencer` → small raw array | Response includes all influencer charts (`uniqueAuthorsByKeyword`, `uniqueSitesByChannel`, etc.) **and** a `topInfluencer` summary object (not the raw array) |
| **Single chart + topInfluencer** | `chartName = 'UniqueAuthorsTopic'` | `getGroupedData` → `[]`, `getTopInfluencer` → small raw array | Response includes only `uniqueAuthorsByKeyword` chart from `processChart()` and a `topInfluencer` summary; charts only available via `processAllCharts()` are **not** present |
| **Repository error handling** | Any valid DTO | `getGroupedData` throws | `query(dto)` throws `BadRequestException` wrapping the error instead of leaking raw errors |

These cases ensure that:

- The new summary shape is always returned under `topInfluencer`, regardless of whether a specific chart is requested.
- The public API cannot accidentally expose the raw aggregation rows.
- Errors from the repository layer are translated into consistent HTTP errors.

---

## Notes on repository aggregation

`InfluencerRepository.getTopInfluencer(dto)` is responsible for mirroring the legacy `getTopInfluencer` aggregation from `examples/influencer.js`. In particular it:

- Projects a stable author identifier into `_id`, resolving from:
  - `content.from.id` → `content.user.id_str` → `content.uid` → `content.pageName` → `content.author_id`.
- Projects:
  - `name` from multiple fallbacks (`from.name`, `user.name`, `user.username`, `snippet.channelTitle`, `username`, `author`).
  - `pic_profile` via `PIC_PROFILE_COND`.
  - `follower` from `follower` or nested follower-like fields.
  - `subUrl` via `SUB_URL_COND` (channel-aware profile URL or domain).
  - `engagement` from `totalEngagement`.
- Filters out `_id === ''` and `name === null`.
- Groups by `_id` to compute:
  - `post` = number of messages per author.
  - Total `engagement` per author.

Higher-level tests in the service spec treat the repository as a black box and focus on verifying the summary output. If needed, future repository-specific tests can assert on the exact aggregation output for known sample documents.

---

## Total tests

Current Influencer tests include:

- **4** test cases for the `buildTopInfluencer` summary logic (normal, `_id === 'null'`, empty input, >100 authors).
- **3** test cases for `InfluencerService.query()` behaviour (all charts, single chart, error handling).

> As the Influencer feature evolves (e.g. additional summary metrics, new charts, or repository tweaks), more focused tests can be added following the same pattern: small, pure helpers tested directly, and service orchestration tested with mocked repositories.


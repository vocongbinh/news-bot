# Curated News & Reading Digest Bot — Design Spec

**Date:** 2026-09-24  
**Status:** Approved for implementation planning  
**Approach:** Monolith TypeScript pipeline on GitHub Actions (Approach 1)

## 1. Goal

Build a personal curated reading digest that:

- Pulls articles from RSS/Atom feeds and Hacker News
- Filters for software-engineering relevance with rule-based scoring
- Summarizes only the top candidates with Gemini Flash
- Delivers a hybrid digest to Telegram at fixed times
- Runs 100% on GitHub Actions (no VPS, no always-on bot server)
- Stays comfortably within free-tier limits (GitHub Actions minutes + Gemini Flash)

### Success criteria

- 3 scheduled digests/day (07:00 / 12:00 / 19:00 Asia/Ho_Chi_Minh)
- Roughly 8–15 curated articles/day across runs
- Typical run completes in 1–3 minutes
- Monthly Actions usage well under 50% of 2,000 free minutes
- No duplicate summaries for the same article URL/ID
- English summaries: 3–5 bullets + 1 key insight, narrative but concise

### Non-goals (MVP)

- Telegram callback/webhook bot or always-on worker
- External KV/DB (Upstash, Supabase, Cloudflare KV/D1)
- Complex newsletter HTML scraping
- Multi-user / multi-chat delivery
- Personalization from click behavior

## 2. Constraints & Decisions

| Topic | Decision |
|---|---|
| Runner | GitHub Actions only (`schedule` + `workflow_dispatch`) |
| Language | TypeScript / Node.js 20 |
| Volume | ~8–15 articles/day |
| Delivery | Hybrid: timed digest session + per-article messages |
| Telegram buttons | URL buttons only (no `callback_data`) |
| State | `state/seen.json` committed to the repo |
| LLM | Gemini Flash, English output |
| Tone | Slightly narrative + opinionated key insight |
| Topics | SE-focused: AI/tooling, LeetCode, system design, interview trends/experience, new tech, eng productivity |

## 3. Architecture

One scheduled workflow runs a single end-to-end pipeline:

```
config/sources.yaml + config/topics.yaml
        ↓
[1] Fetch     RSS feeds + HN top
        ↓
[2] Filter    rule-based score, dedupe vs seen.json, top K
        ↓
[3] Extract   Readability → clean text → truncate
        ↓
[4] Summarize Gemini Flash → structured JSON
        ↓
[5] Render    Telegram HTML + URL inline keyboards
        ↓
[6] Send      header message + one message per article
        ↓
[7] Persist   update + commit state/seen.json
```

### Module boundaries

| Module | Responsibility | Input | Output |
|---|---|---|---|
| `fetchers/` | Source adapters | source config | `RawItem[]` |
| `filter/` | Score, allow/deny, dedupe, top-K | raw items + seen set | ranked candidates |
| `extract/` | HTML → clean text | URL/HTML | truncated plain text |
| `summarize/` | LLM call + schema validation | clean text + metadata | summary JSON or skip |
| `telegram/` | Format + send | summaries | Telegram API calls |
| `state/` | Load/save seen map | filesystem | seen map helpers |
| `main.ts` | Orchestration + error policy | env/config | exit code |

### Secrets

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `GEMINI_API_KEY`
- Builtin `GITHUB_TOKEN` (with `contents: write`) to commit state

## 4. State & Deduplication

### Store

- Path: `state/seen.json`
- Durable via git commit after successful sends
- No GitHub Cache/Artifacts for primary state (eviction risk)
- No external DB in MVP

### Schema

```json
{
  "version": 1,
  "updatedAt": "2026-09-24T07:00:00+07:00",
  "items": {
    "hn:12345678": {
      "url": "https://example.com/article",
      "title": "Example",
      "source": "hn",
      "seenAt": "2026-09-24T07:00:00+07:00",
      "digestAt": "2026-09-24T07:00:00+07:00",
      "status": "sent"
    },
    "rss:source-id:guid-or-hash": {
      "url": "https://example.com/other",
      "title": "Other",
      "source": "rss:source-id",
      "seenAt": "2026-09-24T07:00:00+07:00",
      "digestAt": "2026-09-24T07:00:00+07:00",
      "status": "sent"
    }
  }
}
```

`status` values:

- `sent` — delivered to Telegram
- `skipped` — off-topic / LLM `skip: true` / permanently abandoned after extract retries
- `extract_failed` — extract failed once; eligible for exactly one retry on a later run

Items with any status key present are excluded from normal selection, except `extract_failed`, which may be retried once.

### Stable IDs

- HN: `hn:{objectID}`
- RSS: `rss:{sourceId}:{guid || stableHash(link)}`
- Never key by title alone

### Persistence rules

1. Load `seen.json` (missing file → empty store)
2. Exclude items already present unless status is `extract_failed` (one retry allowed)
3. Persist outcomes in the working copy of `seen.json` as they become final:
   - Telegram send OK → `sent`
   - LLM `skip: true` or hard off-topic → `skipped`
   - First extract failure → `extract_failed`
   - Second extract failure → `skipped`
4. Never mark an article `sent` unless its Telegram message succeeded
5. If a later article in the batch fails to send, keep earlier successful marks and fail the job after retries
6. The TypeScript pipeline writes `state/seen.json`; the workflow commit step only commits/pushes that file
7. Commit + push with `github-actions[bot]`; commit message includes `[skip ci]`
8. On push race: `git pull --rebase` + retry up to 2 times
9. Use workflow `concurrency.group: digest-bot` with `cancel-in-progress: false`

### Retention

- Prune entries older than **30 days** on each successful run
- Keeps file small at ~8–15 articles/day

## 5. Data Pipeline

### 5.1 Fetch

**RSS/Atom**

- Configured in `config/sources.yaml`
- Fields per source: `id`, `url`, `weight`, `tags`
- Parser: `rss-parser`

**Hacker News**

- Top stories API (Firebase/Algolia)
- Keep stories from a recent window (about last 12–18 hours)
- Keep `objectID`, `url`, `title`, `points`, `num_comments`

**Normalized `RawItem`**

```ts
{
  id: string
  url: string
  title: string
  source: string
  publishedAt?: string
  points?: number
  snippet?: string
  discussionUrl?: string
}
```

### 5.2 Rule-based filter (before LLM)

Purpose: minimize token spend and keep digest SE-relevant.

**Allow / boost themes**

- AI/ML tooling useful to engineers
- Popular engineering tools
- LeetCode / algorithm practice
- System design
- Interview trends and interview experiences
- New languages, frameworks, infra
- Engineering productivity / career-for-engineers

**Deny / penalize themes**

- Pure politics, celebrity, sports
- Crypto price speculation
- Generic marketing / non-eng lifestyle

**Score**

```
score = sourceWeight
      + keywordBoost(title + snippet)
      + recencyBoost(publishedAt)
      + hnPointsBoost(points)      // HN only
      - denyPenalty
```

Rules:

- Drop if below threshold or hard-deny match
- Dedupe against `seen.json`
- Keep **top K** candidates per run, **K = 5–8**
- Expected: 3 runs × ~6 articles ≈ 8–15/day after cross-run dedupe

Keyword lists and weights live in `config/topics.yaml` so tuning does not require code changes.

### 5.3 Content extraction

1. Fetch HTML with short timeout and fixed User-Agent
2. Extract main content with `@mozilla/readability` + `jsdom`
3. Normalize whitespace to plain text / minimal markdown
4. Truncate to ~4–6k characters before LLM (prefer lead + headed sections)

**Fallbacks**

- If HTML extract fails → RSS `content:encoded` / `description` / HN title+snippet
- If still too thin → do not call LLM; mark `extract_failed` (or `skipped` if this was already the retry)
- Exactly one cross-run extract retry is allowed via status `extract_failed`

### 5.4 Summarization (Gemini Flash)

**Model**

- Default: `gemini-1.5-flash` (override via env `GEMINI_MODEL` if needed)

**Style**

- English
- Clear, slightly opinionated
- No fluff / marketing tone
- 3–5 bullets + 1 key insight
- Output capped near 300 tokens

**System prompt (canonical draft)**

```text
You are a senior software engineer writing a concise reading digest.
Summarize ONLY engineering-relevant content for busy developers.
Style: clear, slightly opinionated, no fluff, no marketing tone.
Output MUST be valid JSON matching the schema. Keep total output under 300 tokens.
If the article is weak or off-topic for software engineers, set "skip": true.
```

**Required JSON schema**

```json
{
  "skip": false,
  "topicTags": ["system-design", "interview"],
  "readingMinutes": 8,
  "bullets": ["...", "...", "..."],
  "keyInsight": "One sentence: why this matters for an engineer.",
  "hook": "Optional 1-line teaser"
}
```

**LLM controls**

- `maxOutputTokens`: ~300–320
- Temperature: ~0.3
- One request per article
- Concurrency limit: 3
- If `skip: true`, omit from digest and mark `skipped` in seen store

### 5.5 Error policy

| Failure | Behavior |
|---|---|
| One RSS source fails | Continue other sources |
| Extract fails | Fallback text if possible; else mark `extract_failed` / `skipped` |
| One LLM call fails | Skip item, continue batch |
| Telegram send fails mid-batch | Keep seen only for successfully sent items; fail job if unresolved |
| Config/env missing | Fail fast |
| State push fails after send | Retry rebase/push; fail job if still failing (manual recovery may be needed) |

## 6. GitHub Actions Runtime

### Schedule

- 07:00 / 12:00 / 19:00 `Asia/Ho_Chi_Minh`
- UTC cron equivalents:
  - `0 0 * * *`
  - `0 5 * * *`
  - `0 12 * * *`
- Also support `workflow_dispatch` for manual tests

### Budget

- ~90 scheduled runs/month
- Target wall clock: **1–3 minutes/run**
- Expected monthly usage: ~90–270 minutes (**~5–14%** of 2,000)
- Hard job timeout: **10 minutes**

### Runtime choices

- Node.js 20 LTS
- `npm ci` with `actions/setup-node` npm cache
- Execute via `npx tsx src/main.ts` for MVP (can switch to `tsc` later if needed)
- `fetch-depth: 1` on checkout
- No browsers, no matrix builds, no heavy artifacts

### Performance tactics

- Tight HTTP timeouts
- Bounded parallelism (extract/summarize)
- Exit early when filter yields 0 candidates (no Telegram spam, minimal billable time)

## 7. Telegram UX

### Delivery shape

Pipeline order for sending:

1. Finish fetch → filter → extract → summarize for the batch first
2. If zero sendable summaries remain: send nothing
3. Otherwise send one **header** message for the time slot
4. Then send one **article** message per summary (score descending)
5. Each article message includes an inline keyboard with **URL buttons only**

Never send a header unless at least one article message will follow in the same run.

### Parse mode

- Use **HTML** (not MarkdownV2)
- Escape `<`, `>`, `&` in dynamic text
- Allowed tags: `<b>`, `<i>`, `<a href>`, limited `<code>`

### Templates

**Header**

```html
☀️ <b>Morning Digest</b> · Thu 24 Sep · 07:00 ICT
<code>5 picks</code> for software engineers
```

Labels:

- Morning → ☀️
- Midday → 🌤
- Evening → 🌙

**Article**

```html
🏷 <b>system-design</b> · <b>interview</b>  ·  ⏱ 8 min
<b>Title of the article here</b>

• Bullet one…
• Bullet two…
• Bullet three…

💡 <i>Key insight: one sentence why this matters.</i>
```

**Buttons**

- `Read article` → canonical article URL
- `HN discussion` → only when source is HN

### Send behavior

- Sequential sends with 300–500ms delay to respect rate limits
- Retry a failed article send once
- Do not edit prior messages; digests are append-only in chat
- Target: private chat via `TELEGRAM_CHAT_ID`

## 8. Project Structure

```text
news-bot/
├── .github/workflows/digest.yml
├── config/
│   ├── sources.yaml
│   └── topics.yaml
├── state/
│   └── seen.json
├── src/
│   ├── main.ts
│   ├── config.ts
│   ├── fetchers/
│   │   ├── rss.ts
│   │   ├── hn.ts
│   │   └── types.ts
│   ├── filter/
│   │   └── rank.ts
│   ├── extract/
│   │   └── readability.ts
│   ├── summarize/
│   │   ├── gemini.ts
│   │   └── prompt.ts
│   ├── telegram/
│   │   ├── format.ts
│   │   └── send.ts
│   ├── state/
│   │   └── seen.ts
│   └── util/
│       ├── http.ts
│       └── time.ts
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

## 9. Workflow Blueprint

```yaml
name: Reading Digest

on:
  schedule:
    # 07:00 / 12:00 / 19:00 Asia/Ho_Chi_Minh (UTC+7)
    - cron: '0 0 * * *'
    - cron: '0 5 * * *'
    - cron: '0 12 * * *'
  workflow_dispatch:

concurrency:
  group: digest-bot
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  digest:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install
        run: npm ci

      - name: Run digest pipeline
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GEMINI_MODEL: gemini-1.5-flash
          TZ: Asia/Ho_Chi_Minh
        run: npx tsx src/main.ts

      - name: Commit seen state
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add state/seen.json
          git diff --staged --quiet && echo "No state changes" && exit 0
          git commit -m "chore(state): update seen.json [skip ci]"
          git pull --rebase origin main
          git push
```

## 10. Testing Strategy (MVP)

- Manual runs via `workflow_dispatch`
- Local run with env vars + existing `state/seen.json`
- Prefer lightweight unit tests for:
  - `filter/rank.ts` scoring and deny/allow behavior
  - `telegram/format.ts` HTML escaping and message layout
- Full e2e against live Telegram/Gemini is optional in CI for MVP (saves Actions minutes)

## 11. Implementation Phases (high level)

1. Scaffold repo (package.json, tsconfig, config YAML, empty seen.json, workflow)
2. Fetchers + filter + seen store (no LLM yet; log selected URLs)
3. Extraction + Gemini summarization
4. Telegram formatting/sending
5. Wire orchestration + state commit path
6. Dry-run via `workflow_dispatch`, then enable schedule

## 12. Open tuning knobs (explicit, not blockers)

These are intentionally configurable after MVP is running:

- Exact source list in `sources.yaml`
- Keyword weights/thresholds in `topics.yaml`
- K per run (default 5–8)
- Truncation length (default 4–6k chars)
- Whether midday digest stays enabled if volume is low

No unresolved product decisions remain for MVP scope.

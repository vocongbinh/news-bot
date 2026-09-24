# Curated News Digest Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Actions–scheduled TypeScript pipeline that fetches RSS + Hacker News, filters for software-engineering relevance, summarizes with Gemini Flash, and sends a hybrid Telegram digest while persisting dedupe state in `state/seen.json`.

**Architecture:** One monolith Node 20 / TypeScript job per cron run: fetch → rule-based rank/dedupe → Readability extract → Gemini summarize → Telegram HTML messages (header + per-article URL buttons) → write `state/seen.json` for the workflow to commit. No external DB, no always-on bot.

**Tech Stack:** TypeScript, Node 20, `tsx`, `vitest`, `rss-parser`, `jsdom` + `@mozilla/readability`, `yaml`, `@google/generative-ai`, Telegram Bot HTTP API, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-24-curated-news-digest-bot-design.md`

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | Scripts (`digest`, `test`) and dependencies |
| `tsconfig.json` | Strict TypeScript config for Node ESM |
| `.gitignore` | `node_modules`, `.env`, logs |
| `config/sources.yaml` | RSS sources + HN enablement/weights |
| `config/topics.yaml` | Allow/deny keywords, scoring knobs, `topK` |
| `state/seen.json` | Durable dedupe store committed by Actions |
| `.github/workflows/digest.yml` | Cron + manual dispatch + state commit |
| `src/fetchers/types.ts` | Shared `RawItem` / summary types |
| `src/util/hash.ts` | Stable content hash for RSS IDs |
| `src/util/http.ts` | Fetch helper with timeout + User-Agent |
| `src/util/time.ts` | ICT slot labels / ISO timestamps |
| `src/config.ts` | Load YAML + required env secrets |
| `src/state/seen.ts` | Load/save/prune/mark seen store |
| `src/filter/rank.ts` | Score, deny, dedupe, top-K selection |
| `src/fetchers/rss.ts` | RSS/Atom → `RawItem[]` |
| `src/fetchers/hn.ts` | HN Algolia → `RawItem[]` |
| `src/extract/readability.ts` | HTML → truncated clean text |
| `src/summarize/prompt.ts` | System prompt + user payload builder |
| `src/summarize/gemini.ts` | Gemini call + JSON schema validation |
| `src/telegram/format.ts` | HTML escape + header/article templates |
| `src/telegram/send.ts` | `sendMessage` with retry + delay |
| `src/main.ts` | Orchestration + error policy |
| `tests/filter/rank.test.ts` | Scoring / deny / top-K / dedupe |
| `tests/state/seen.test.ts` | Load/save/prune/retry status rules |
| `tests/telegram/format.test.ts` | Escape + message layout |
| `README.md` | Setup secrets, local run, schedule |

---

### Task 1: Scaffold project tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md` (minimal stub; expand in final task)
- Create: `state/seen.json`
- Create: `config/sources.yaml`
- Create: `config/topics.yaml`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "news-bot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "digest": "tsx src/main.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@mozilla/readability": "^0.5.0",
    "jsdom": "^25.0.1",
    "rss-parser": "^3.13.0",
    "yaml": "^2.6.0"
  },
  "devDependencies": {
    "@types/jsdom": "^21.1.7",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
*.log
.DS_Store
```

- [ ] **Step 4: Create initial config + empty state**

`state/seen.json`:

```json
{
  "version": 1,
  "updatedAt": "2026-09-24T00:00:00+07:00",
  "items": {}
}
```

`config/sources.yaml`:

```yaml
hn:
  enabled: true
  weight: 8
  windowHours: 18
  maxItems: 40

rss:
  - id: simonwillison
    url: https://simonwillison.net/atom/everything/
    weight: 10
    tags: [ai, tooling]
  - id: joelonsoftware
    url: https://www.joelonsoftware.com/feed/
    weight: 7
    tags: [engineering]
  - id: maria-systems
    url: https://example.com/replace-me/rss.xml
    weight: 6
    tags: [system-design]
    enabled: false
```

`config/topics.yaml`:

```yaml
topK: 6
minScore: 6
truncateChars: 5000

allowKeywords:
  - ai
  - llm
  - gpt
  - rust
  - golang
  - typescript
  - kubernetes
  - leetcode
  - system design
  - distributed
  - interview
  - devops
  - observability
  - postgres
  - redis
  - docker
  - kubernetes
  - compiler
  - performance
  - security
  - open source

denyKeywords:
  - celebrity
  - bitcoin price
  - crypto price
  - sports score
  - election
  - box office

weights:
  keywordHit: 3
  recencyMax: 4
  hnPointsDivisor: 25
  denyHit: 20
```

- [ ] **Step 5: Create stub README**

```markdown
# news-bot

Curated software-engineering reading digest for Telegram, powered by GitHub Actions + Gemini Flash.

See `docs/superpowers/specs/2026-09-24-curated-news-digest-bot-design.md`.
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`  
Expected: lockfile created; no errors

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore README.md state/seen.json config/sources.yaml config/topics.yaml
git commit -m "chore: scaffold news-bot tooling and config"
```

---

### Task 2: Shared types and utilities

**Files:**
- Create: `src/fetchers/types.ts`
- Create: `src/util/hash.ts`
- Create: `src/util/http.ts`
- Create: `src/util/time.ts`

- [ ] **Step 1: Create shared types in `src/fetchers/types.ts`**

```ts
export type SeenStatus = 'sent' | 'skipped' | 'extract_failed';

export interface RawItem {
  id: string;
  url: string;
  title: string;
  source: string;
  publishedAt?: string;
  points?: number;
  snippet?: string;
  discussionUrl?: string;
  rawContent?: string;
}

export interface RankedItem extends RawItem {
  score: number;
}

export interface ArticleSummary {
  item: RankedItem;
  skip: boolean;
  topicTags: string[];
  readingMinutes: number;
  bullets: string[];
  keyInsight: string;
  hook?: string;
}

export interface SeenItem {
  url: string;
  title: string;
  source: string;
  seenAt: string;
  digestAt?: string;
  status: SeenStatus;
}

export interface SeenStore {
  version: 1;
  updatedAt: string;
  items: Record<string, SeenItem>;
}
```

- [ ] **Step 2: Create `src/util/hash.ts`**

```ts
import { createHash } from 'node:crypto';

export function stableHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
```

- [ ] **Step 3: Create `src/util/http.ts`**

```ts
const DEFAULT_UA =
  'news-bot/0.1 (+https://github.com/binhvc/news-bot; personal digest)';

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; accept?: string } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_UA,
        accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const text = await fetchText(url, {
    timeoutMs,
    accept: 'application/json',
  });
  return JSON.parse(text) as T;
}
```

- [ ] **Step 4: Create `src/util/time.ts`**

```ts
export type DigestSlot = 'morning' | 'midday' | 'evening';

export function nowIso(timeZone = 'Asia/Ho_Chi_Minh'): string {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+07:00`;
}

export function detectDigestSlot(date = new Date(), timeZone = 'Asia/Ho_Chi_Minh'): DigestSlot {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date),
  );
  if (hour < 10) return 'morning';
  if (hour < 16) return 'midday';
  return 'evening';
}

export function formatDigestHeading(date = new Date(), timeZone = 'Asia/Ho_Chi_Minh'): {
  slot: DigestSlot;
  emoji: string;
  label: string;
  when: string;
} {
  const slot = detectDigestSlot(date, timeZone);
  const emoji = slot === 'morning' ? '☀️' : slot === 'midday' ? '🌤' : '🌙';
  const label =
    slot === 'morning' ? 'Morning Digest' : slot === 'midday' ? 'Midday Digest' : 'Evening Digest';
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return { slot, emoji, label, when: `${when} ICT` };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/fetchers/types.ts src/util/hash.ts src/util/http.ts src/util/time.ts
git commit -m "feat: add shared types and HTTP/time utilities"
```

---

### Task 3: Seen-state store (TDD)

**Files:**
- Create: `tests/state/seen.test.ts`
- Create: `src/state/seen.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadSeen,
  saveSeen,
  pruneSeen,
  shouldConsider,
  markSeen,
} from '../../src/state/seen.ts';
import type { SeenStore } from '../../src/fetchers/types.ts';

function emptyStore(): SeenStore {
  return { version: 1, updatedAt: '2026-09-01T00:00:00+07:00', items: {} };
}

describe('seen store', () => {
  it('loads empty store when file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seen-'));
    const store = loadSeen(join(dir, 'missing.json'));
    expect(store.items).toEqual({});
    expect(store.version).toBe(1);
  });

  it('round-trips save/load', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seen-'));
    const path = join(dir, 'seen.json');
    const store = emptyStore();
    markSeen(store, {
      id: 'hn:1',
      url: 'https://example.com',
      title: 'Hello',
      source: 'hn',
      status: 'sent',
      at: '2026-09-24T07:00:00+07:00',
    });
    saveSeen(path, store);
    const loaded = loadSeen(path);
    expect(loaded.items['hn:1']?.status).toBe('sent');
  });

  it('allows retry only for extract_failed', () => {
    const store = emptyStore();
    store.items['a'] = {
      url: 'u',
      title: 't',
      source: 'hn',
      seenAt: '2026-09-01T00:00:00+07:00',
      status: 'sent',
    };
    store.items['b'] = {
      url: 'u2',
      title: 't2',
      source: 'hn',
      seenAt: '2026-09-01T00:00:00+07:00',
      status: 'extract_failed',
    };
    expect(shouldConsider(store, 'a')).toBe(false);
    expect(shouldConsider(store, 'b')).toBe(true);
    expect(shouldConsider(store, 'c')).toBe(true);
  });

  it('prunes entries older than 30 days', () => {
    const store = emptyStore();
    store.items['old'] = {
      url: 'u',
      title: 't',
      source: 'hn',
      seenAt: '2026-01-01T00:00:00+07:00',
      status: 'sent',
    };
    store.items['new'] = {
      url: 'u2',
      title: 't2',
      source: 'hn',
      seenAt: '2026-09-20T00:00:00+07:00',
      status: 'sent',
    };
    pruneSeen(store, new Date('2026-09-24T00:00:00+07:00'), 30);
    expect(store.items.old).toBeUndefined();
    expect(store.items.new).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/state/seen.test.ts`  
Expected: FAIL (module not found / exports missing)

- [ ] **Step 3: Implement `src/state/seen.ts`**

```ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SeenStatus, SeenStore } from '../fetchers/types.ts';
import { nowIso } from '../util/time.ts';

export function loadSeen(path: string): SeenStore {
  if (!existsSync(path)) {
    return { version: 1, updatedAt: nowIso(), items: {} };
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as SeenStore;
  return {
    version: 1,
    updatedAt: raw.updatedAt ?? nowIso(),
    items: raw.items ?? {},
  };
}

export function saveSeen(path: string, store: SeenStore): void {
  store.updatedAt = nowIso();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export function shouldConsider(store: SeenStore, id: string): boolean {
  const existing = store.items[id];
  if (!existing) return true;
  return existing.status === 'extract_failed';
}

export function markSeen(
  store: SeenStore,
  input: {
    id: string;
    url: string;
    title: string;
    source: string;
    status: SeenStatus;
    at?: string;
  },
): void {
  const at = input.at ?? nowIso();
  store.items[input.id] = {
    url: input.url,
    title: input.title,
    source: input.source,
    seenAt: at,
    digestAt: input.status === 'sent' ? at : store.items[input.id]?.digestAt,
    status: input.status,
  };
}

export function pruneSeen(store: SeenStore, now = new Date(), retainDays = 30): void {
  const cutoff = now.getTime() - retainDays * 24 * 60 * 60 * 1000;
  for (const [id, item] of Object.entries(store.items)) {
    const ts = Date.parse(item.seenAt);
    if (Number.isFinite(ts) && ts < cutoff) {
      delete store.items[id];
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/state/seen.test.ts`  
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/state/seen.ts tests/state/seen.test.ts
git commit -m "feat: add seen.json state store with retry semantics"
```

---

### Task 4: Config loader

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Implement `src/config.ts`**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface RssSourceConfig {
  id: string;
  url: string;
  weight: number;
  tags?: string[];
  enabled?: boolean;
}

export interface SourcesConfig {
  hn: {
    enabled: boolean;
    weight: number;
    windowHours: number;
    maxItems: number;
  };
  rss: RssSourceConfig[];
}

export interface TopicsConfig {
  topK: number;
  minScore: number;
  truncateChars: number;
  allowKeywords: string[];
  denyKeywords: string[];
  weights: {
    keywordHit: number;
    recencyMax: number;
    hnPointsDivisor: number;
    denyHit: number;
  };
}

export interface AppConfig {
  sources: SourcesConfig;
  topics: TopicsConfig;
  telegramBotToken: string;
  telegramChatId: string;
  geminiApiKey: string;
  geminiModel: string;
  seenPath: string;
  dryRun: boolean;
}

function loadYaml<T>(path: string): T {
  return parseYaml(readFileSync(path, 'utf8')) as T;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(rootDir = process.cwd()): AppConfig {
  const sources = loadYaml<SourcesConfig>(resolve(rootDir, 'config/sources.yaml'));
  const topics = loadYaml<TopicsConfig>(resolve(rootDir, 'config/topics.yaml'));
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  const telegramBotToken = dryRun
    ? process.env.TELEGRAM_BOT_TOKEN ?? 'dry-run-token'
    : requiredEnv('TELEGRAM_BOT_TOKEN');
  const telegramChatId = dryRun
    ? process.env.TELEGRAM_CHAT_ID ?? 'dry-run-chat'
    : requiredEnv('TELEGRAM_CHAT_ID');
  const geminiApiKey = dryRun
    ? process.env.GEMINI_API_KEY ?? 'dry-run-gemini'
    : requiredEnv('GEMINI_API_KEY');

  return {
    sources,
    topics,
    telegramBotToken,
    telegramChatId,
    geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    seenPath: resolve(rootDir, 'state/seen.json'),
    dryRun,
  };
}
```

- [ ] **Step 2: Smoke-check config load**

Run:

```bash
DRY_RUN=1 npx tsx -e "import { loadConfig } from './src/config.ts'; console.log(loadConfig().topics.topK)"
```

Expected: prints `6`

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: load sources/topics YAML and env secrets"
```

---

### Task 5: Rule-based ranker (TDD)

**Files:**
- Create: `tests/filter/rank.test.ts`
- Create: `src/filter/rank.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { rankItems } from '../../src/filter/rank.ts';
import type { RawItem, SeenStore } from '../../src/fetchers/types.ts';
import type { TopicsConfig } from '../../src/config.ts';

const topics: TopicsConfig = {
  topK: 2,
  minScore: 6,
  truncateChars: 5000,
  allowKeywords: ['system design', 'leetcode', 'typescript'],
  denyKeywords: ['celebrity', 'bitcoin price'],
  weights: {
    keywordHit: 3,
    recencyMax: 4,
    hnPointsDivisor: 25,
    denyHit: 20,
  },
};

function item(partial: Partial<RawItem> & Pick<RawItem, 'id' | 'title'>): RawItem {
  return {
    url: `https://example.com/${partial.id}`,
    source: 'hn',
    publishedAt: new Date().toISOString(),
    points: 50,
    ...partial,
  };
}

describe('rankItems', () => {
  it('drops hard-deny items and keeps SE-relevant topK', () => {
    const seen: SeenStore = { version: 1, updatedAt: '', items: {} };
    const ranked = rankItems(
      [
        item({ id: '1', title: 'Celebrity gossip roundup' }),
        item({ id: '2', title: 'System design for TypeScript services' }),
        item({ id: '3', title: 'LeetCode patterns for interviews' }),
        item({ id: '4', title: 'Random gardening tips' }),
      ],
      seen,
      topics,
      { hn: 8 },
    );
    expect(ranked.map((r) => r.id)).toEqual(['2', '3']);
  });

  it('skips already-sent ids but retries extract_failed', () => {
    const seen: SeenStore = {
      version: 1,
      updatedAt: '',
      items: {
        '2': {
          url: 'u',
          title: 't',
          source: 'hn',
          seenAt: '2026-09-01T00:00:00+07:00',
          status: 'sent',
        },
        '3': {
          url: 'u3',
          title: 't3',
          source: 'hn',
          seenAt: '2026-09-01T00:00:00+07:00',
          status: 'extract_failed',
        },
      },
    };
    const ranked = rankItems(
      [
        item({ id: '2', title: 'System design deep dive' }),
        item({ id: '3', title: 'LeetCode interview guide' }),
      ],
      seen,
      topics,
      { hn: 8 },
    );
    expect(ranked.map((r) => r.id)).toEqual(['3']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/filter/rank.test.ts`  
Expected: FAIL (`rankItems` not found)

- [ ] **Step 3: Implement `src/filter/rank.ts`**

```ts
import type { TopicsConfig } from '../config.ts';
import type { RankedItem, RawItem, SeenStore } from '../fetchers/types.ts';
import { shouldConsider } from '../state/seen.ts';

function normalize(text: string): string {
  return text.toLowerCase();
}

function keywordHits(text: string, keywords: string[]): number {
  const hay = normalize(text);
  let hits = 0;
  for (const kw of keywords) {
    if (hay.includes(kw.toLowerCase())) hits += 1;
  }
  return hits;
}

function recencyBoost(publishedAt: string | undefined, max: number): number {
  if (!publishedAt) return 0;
  const ageHours = (Date.now() - Date.parse(publishedAt)) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours < 0) return 0;
  if (ageHours <= 6) return max;
  if (ageHours <= 24) return Math.ceil(max / 2);
  if (ageHours <= 72) return 1;
  return 0;
}

export function scoreItem(
  item: RawItem,
  topics: TopicsConfig,
  sourceWeights: Record<string, number>,
): number {
  const text = `${item.title}\n${item.snippet ?? ''}`;
  const denyHits = keywordHits(text, topics.denyKeywords);
  if (denyHits > 0) {
    return -topics.weights.denyHit * denyHits;
  }
  const sourceKey = item.source.startsWith('rss:')
    ? item.source.slice(4)
    : item.source;
  const sourceWeight = sourceWeights[sourceKey] ?? sourceWeights[item.source] ?? 5;
  const allowHits = keywordHits(text, topics.allowKeywords);
  const pointsBoost = item.points
    ? Math.min(6, item.points / topics.weights.hnPointsDivisor)
    : 0;
  return (
    sourceWeight +
    allowHits * topics.weights.keywordHit +
    recencyBoost(item.publishedAt, topics.weights.recencyMax) +
    pointsBoost
  );
}

export function rankItems(
  items: RawItem[],
  seen: SeenStore,
  topics: TopicsConfig,
  sourceWeights: Record<string, number>,
): RankedItem[] {
  const ranked: RankedItem[] = [];
  for (const item of items) {
    if (!shouldConsider(seen, item.id)) continue;
    const score = scoreItem(item, topics, sourceWeights);
    if (score < topics.minScore) continue;
    ranked.push({ ...item, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return ranked.slice(0, topics.topK);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/filter/rank.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/filter/rank.ts tests/filter/rank.test.ts
git commit -m "feat: add SE topic ranking and top-K selection"
```

---

### Task 6: Telegram HTML formatter (TDD)

**Files:**
- Create: `tests/telegram/format.test.ts`
- Create: `src/telegram/format.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  formatHeader,
  formatArticle,
  buildArticleKeyboard,
} from '../../src/telegram/format.ts';
import type { ArticleSummary } from '../../src/fetchers/types.ts';

describe('telegram format', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('A <B> & C')).toBe('A &lt;B&gt; &amp; C');
  });

  it('formats header and article payloads', () => {
    const summary: ArticleSummary = {
      skip: false,
      topicTags: ['system-design', 'interview'],
      readingMinutes: 8,
      bullets: ['One <trick>', 'Two', 'Three'],
      keyInsight: 'Trade-offs beat slogans.',
      item: {
        id: 'hn:1',
        url: 'https://example.com/a',
        title: 'Design & Scale',
        source: 'hn',
        score: 12,
        discussionUrl: 'https://news.ycombinator.com/item?id=1',
      },
    };

    const header = formatHeader({
      emoji: '☀️',
      label: 'Morning Digest',
      when: 'Thu 24 Sep, 07:00 ICT',
      count: 1,
    });
    expect(header).toContain('<b>Morning Digest</b>');
    expect(header).toContain('<code>1 picks</code>');

    const body = formatArticle(summary);
    expect(body).toContain('<b>Design &amp; Scale</b>');
    expect(body).toContain('• One &lt;trick&gt;');
    expect(body).toContain('Key insight');

    const keyboard = buildArticleKeyboard(summary);
    expect(keyboard).toEqual({
      inline_keyboard: [
        [
          { text: 'Read article', url: 'https://example.com/a' },
          { text: 'HN discussion', url: 'https://news.ycombinator.com/item?id=1' },
        ],
      ],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/telegram/format.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/telegram/format.ts`**

```ts
import type { ArticleSummary } from '../fetchers/types.ts';

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function formatHeader(input: {
  emoji: string;
  label: string;
  when: string;
  count: number;
}): string {
  return [
    `${input.emoji} <b>${escapeHtml(input.label)}</b> · ${escapeHtml(input.when)}`,
    `<code>${input.count} picks</code> for software engineers`,
  ].join('\n');
}

export function formatArticle(summary: ArticleSummary): string {
  const tags = summary.topicTags
    .slice(0, 3)
    .map((t) => `<b>${escapeHtml(t)}</b>`)
    .join(' · ');
  const bullets = summary.bullets
    .slice(0, 5)
    .map((b) => `• ${escapeHtml(b)}`)
    .join('\n');
  return [
    `🏷 ${tags}  ·  ⏱ ${summary.readingMinutes} min`,
    `<b>${escapeHtml(summary.item.title)}</b>`,
    '',
    bullets,
    '',
    `💡 <i>Key insight: ${escapeHtml(summary.keyInsight)}</i>`,
  ].join('\n');
}

export function buildArticleKeyboard(summary: ArticleSummary): {
  inline_keyboard: { text: string; url: string }[][];
} {
  const row: { text: string; url: string }[] = [
    { text: 'Read article', url: summary.item.url },
  ];
  if (summary.item.discussionUrl) {
    row.push({ text: 'HN discussion', url: summary.item.discussionUrl });
  }
  return { inline_keyboard: [row] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/telegram/format.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/telegram/format.ts tests/telegram/format.test.ts
git commit -m "feat: format Telegram HTML digest messages"
```

---

### Task 7: RSS + HN fetchers

**Files:**
- Create: `src/fetchers/rss.ts`
- Create: `src/fetchers/hn.ts`

- [ ] **Step 1: Implement RSS fetcher `src/fetchers/rss.ts`**

```ts
import Parser from 'rss-parser';
import type { RssSourceConfig } from '../config.ts';
import type { RawItem } from './types.ts';
import { stableHash } from '../util/hash.ts';

const parser = new Parser({
  timeout: 12_000,
  headers: {
    'user-agent': 'news-bot/0.1 (+https://github.com/binhvc/news-bot)',
  },
});

export async function fetchRssSource(source: RssSourceConfig): Promise<RawItem[]> {
  if (source.enabled === false) return [];
  const feed = await parser.parseURL(source.url);
  return (feed.items ?? [])
    .map((entry) => {
      const url = entry.link?.trim();
      if (!url) return null;
      const guid = entry.guid?.trim() || stableHash(url);
      const snippet = (entry.contentSnippet || entry.summary || entry.content || '')
        .toString()
        .slice(0, 500);
      const rawContent = (entry['content:encoded'] || entry.content || entry.summary || '')
        .toString();
      const item: RawItem = {
        id: `rss:${source.id}:${guid}`,
        url,
        title: entry.title?.trim() || url,
        source: `rss:${source.id}`,
        publishedAt: entry.isoDate || entry.pubDate,
        snippet,
        rawContent,
      };
      return item;
    })
    .filter((x): x is RawItem => x !== null);
}

export async function fetchAllRss(sources: RssSourceConfig[]): Promise<RawItem[]> {
  const settled = await Promise.allSettled(sources.map((s) => fetchRssSource(s)));
  const items: RawItem[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      items.push(...result.value);
    } else {
      console.warn('RSS source failed:', result.reason);
    }
  }
  return items;
}
```

- [ ] **Step 2: Implement HN fetcher `src/fetchers/hn.ts`**

```ts
import { fetchJson } from '../util/http.ts';
import type { RawItem } from './types.ts';

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  story_text?: string;
}

interface HnSearchResponse {
  hits: HnHit[];
}

export async function fetchHnTop(opts: {
  weightWindowHours: number;
  maxItems: number;
}): Promise<RawItem[]> {
  const url =
    'https://hn.algolia.com/api/v1/search' +
    '?tags=story' +
    '&numericFilters=points>20' +
    `&hitsPerPage=${opts.maxItems}`;
  const data = await fetchJson<HnSearchResponse>(url);
  const cutoff = Date.now() - opts.weightWindowHours * 3_600_000;

  return data.hits
    .map((hit) => {
      const link = hit.url?.trim();
      if (!link) return null;
      const createdMs = hit.created_at ? Date.parse(hit.created_at) : NaN;
      if (Number.isFinite(createdMs) && createdMs < cutoff) return null;
      const item: RawItem = {
        id: `hn:${hit.objectID}`,
        url: link,
        title: hit.title?.trim() || link,
        source: 'hn',
        publishedAt: hit.created_at,
        points: hit.points,
        snippet: hit.story_text?.slice(0, 500),
        discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      };
      return item;
    })
    .filter((x): x is RawItem => x !== null);
}
```

- [ ] **Step 3: Smoke-check HN fetch (network)**

Run:

```bash
npx tsx -e "import { fetchHnTop } from './src/fetchers/hn.ts'; const items = await fetchHnTop({ weightWindowHours: 18, maxItems: 5 }); console.log(items.slice(0,2));"
```

Expected: prints 0–2 story objects with `hn:` ids.

- [ ] **Step 4: Commit**

```bash
git add src/fetchers/rss.ts src/fetchers/hn.ts
git commit -m "feat: fetch RSS feeds and Hacker News stories"
```

---

### Task 8: Content extraction

**Files:**
- Create: `src/extract/readability.ts`

- [ ] **Step 1: Implement extractor**

```ts
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import type { RawItem } from '../fetchers/types.ts';
import { fetchText } from '../util/http.ts';

export interface ExtractResult {
  ok: boolean;
  text: string;
  wordCount: number;
}

function normalizeText(input: string): string {
  return input.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}\n…`;
}

export async function extractArticle(
  item: RawItem,
  truncateChars: number,
): Promise<ExtractResult> {
  try {
    const html = await fetchText(item.url, { timeoutMs: 12_000 });
    const dom = new JSDOM(html, { url: item.url });
    const article = new Readability(dom.window.document).parse();
    const text = normalizeText(article?.textContent ?? '');
    if (text.split(/\s+/).filter(Boolean).length >= 80) {
      const clipped = truncate(text, truncateChars);
      return {
        ok: true,
        text: clipped,
        wordCount: clipped.split(/\s+/).filter(Boolean).length,
      };
    }
  } catch (err) {
    console.warn(`extract failed for ${item.id}:`, err);
  }

  const fallback = normalizeText(item.rawContent || item.snippet || '');
  if (fallback.split(/\s+/).filter(Boolean).length >= 40) {
    const clipped = truncate(fallback, truncateChars);
    return {
      ok: true,
      text: clipped,
      wordCount: clipped.split(/\s+/).filter(Boolean).length,
    };
  }

  return { ok: false, text: '', wordCount: 0 };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/extract/readability.ts
git commit -m "feat: extract and truncate article text with Readability"
```

---

### Task 9: Gemini summarization

**Files:**
- Create: `src/summarize/prompt.ts`
- Create: `src/summarize/gemini.ts`

- [ ] **Step 1: Implement prompt helpers `src/summarize/prompt.ts`**

```ts
import type { RankedItem } from '../fetchers/types.ts';

export const SYSTEM_PROMPT = `You are a senior software engineer writing a concise reading digest.
Summarize ONLY engineering-relevant content for busy developers.
Style: clear, slightly opinionated, no fluff, no marketing tone.
Output MUST be valid JSON matching the schema. Keep total output under 300 tokens.
If the article is weak or off-topic for software engineers, set "skip": true.`;

export function buildUserPrompt(item: RankedItem, text: string): string {
  return [
    `Title: ${item.title}`,
    `Source: ${item.source}`,
    `URL: ${item.url}`,
    '',
    'Article text:',
    text,
    '',
    'Return JSON with keys: skip, topicTags, readingMinutes, bullets, keyInsight, hook.',
  ].join('\n');
}
```

- [ ] **Step 2: Implement Gemini client `src/summarize/gemini.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ArticleSummary, RankedItem } from '../fetchers/types.ts';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.ts';

interface ModelJson {
  skip?: boolean;
  topicTags?: unknown;
  readingMinutes?: unknown;
  bullets?: unknown;
  keyInsight?: unknown;
  hook?: unknown;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v)).map((s) => s.trim()).filter(Boolean);
}

export async function summarizeArticle(input: {
  apiKey: string;
  model: string;
  item: RankedItem;
  text: string;
  dryRun?: boolean;
}): Promise<ArticleSummary> {
  if (input.dryRun) {
    return {
      item: input.item,
      skip: false,
      topicTags: input.item.source === 'hn' ? ['hn'] : ['rss'],
      readingMinutes: Math.max(1, Math.ceil(input.text.split(/\s+/).length / 200)),
      bullets: [
        'Dry-run bullet one',
        'Dry-run bullet two',
        'Dry-run bullet three',
      ],
      keyInsight: 'Dry-run mode: LLM call skipped.',
    };
  }

  const genAI = new GoogleGenerativeAI(input.apiKey);
  const model = genAI.getGenerativeModel({
    model: input.model,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 320,
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent(buildUserPrompt(input.item, input.text));
  const raw = result.response.text();
  const parsed = JSON.parse(raw) as ModelJson;
  const bullets = asStringArray(parsed.bullets).slice(0, 5);
  const topicTags = asStringArray(parsed.topicTags).slice(0, 3);
  const keyInsight = String(parsed.keyInsight ?? '').trim();
  const skip = Boolean(parsed.skip) || bullets.length < 3 || !keyInsight;

  return {
    item: input.item,
    skip,
    topicTags,
    readingMinutes: Number(parsed.readingMinutes) || Math.max(1, Math.ceil(input.text.split(/\s+/).length / 200)),
    bullets,
    keyInsight: keyInsight || 'No insight provided.',
    hook: parsed.hook ? String(parsed.hook) : undefined,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/summarize/prompt.ts src/summarize/gemini.ts
git commit -m "feat: summarize articles with Gemini Flash JSON schema"
```

---

### Task 10: Telegram sender

**Files:**
- Create: `src/telegram/send.ts`

- [ ] **Step 1: Implement sender with retry/delay**

```ts
export interface TelegramSendPayload {
  text: string;
  replyMarkup?: unknown;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTelegramMessage(input: {
  botToken: string;
  chatId: string;
  text: string;
  replyMarkup?: unknown;
  dryRun?: boolean;
}): Promise<void> {
  if (input.dryRun) {
    console.log('[dry-run telegram]', input.text.slice(0, 120).replaceAll('\n', ' '));
    return;
  }

  const body: Record<string, unknown> = {
    chat_id: input.chatId,
    text: input.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (input.replyMarkup) {
    body.reply_markup = input.replyMarkup;
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${input.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { ok: boolean; description?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.description ?? `Telegram HTTP ${res.status}`);
      }
      return;
    } catch (err) {
      lastError = err;
      if (attempt < 2) await sleep(500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function sendDigestMessages(input: {
  botToken: string;
  chatId: string;
  header: string;
  articles: TelegramSendPayload[];
  dryRun?: boolean;
}): Promise<number> {
  await sendTelegramMessage({
    botToken: input.botToken,
    chatId: input.chatId,
    text: input.header,
    dryRun: input.dryRun,
  });

  let sent = 0;
  for (const article of input.articles) {
    await sleep(400);
    try {
      await sendTelegramMessage({
        botToken: input.botToken,
        chatId: input.chatId,
        text: article.text,
        replyMarkup: article.replyMarkup,
        dryRun: input.dryRun,
      });
      sent += 1;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      (error as Error & { sentCount?: number }).sentCount = sent;
      throw error;
    }
  }
  return sent;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/telegram/send.ts
git commit -m "feat: send Telegram digest messages with retry"
```

---

### Task 11: Main orchestration

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Implement `src/main.ts` with corrected fetch block**

```ts
import { loadConfig } from './config.ts';
import { extractArticle } from './extract/readability.ts';
import { fetchHnTop } from './fetchers/hn.ts';
import { fetchAllRss } from './fetchers/rss.ts';
import type { ArticleSummary, RawItem } from './fetchers/types.ts';
import { rankItems } from './filter/rank.ts';
import { loadSeen, markSeen, pruneSeen, saveSeen } from './state/seen.ts';
import { summarizeArticle } from './summarize/gemini.ts';
import { buildArticleKeyboard, formatArticle, formatHeader } from './telegram/format.ts';
import { sendDigestMessages } from './telegram/send.ts';
import { formatDigestHeading, nowIso } from './util/time.ts';

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const seen = loadSeen(config.seenPath);
  pruneSeen(seen, new Date(), 30);

  const raw: RawItem[] = [];
  raw.push(...(await fetchAllRss(config.sources.rss)));
  if (config.sources.hn.enabled) {
    try {
      const hnItems = await fetchHnTop({
        weightWindowHours: config.sources.hn.windowHours,
        maxItems: config.sources.hn.maxItems,
      });
      raw.push(...hnItems);
    } catch (err) {
      console.warn('HN fetch failed:', err);
    }
  }

  const sourceWeights: Record<string, number> = { hn: config.sources.hn.weight };
  for (const src of config.sources.rss) {
    sourceWeights[src.id] = src.weight;
    sourceWeights[`rss:${src.id}`] = src.weight;
  }

  const ranked = rankItems(raw, seen, config.topics, sourceWeights);
  console.log(`Fetched ${raw.length} items; selected ${ranked.length}`);
  if (ranked.length === 0) {
    saveSeen(config.seenPath, seen);
    return;
  }

  const extracted = await mapLimit(ranked, 3, async (item) => ({
    item,
    extract: await extractArticle(item, config.topics.truncateChars),
  }));

  const sendable: ArticleSummary[] = [];
  for (const row of extracted) {
    if (!row.extract.ok) {
      const prev = seen.items[row.item.id];
      const status = prev?.status === 'extract_failed' ? 'skipped' : 'extract_failed';
      markSeen(seen, {
        id: row.item.id,
        url: row.item.url,
        title: row.item.title,
        source: row.item.source,
        status,
      });
      continue;
    }

    try {
      const summary = await summarizeArticle({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        item: row.item,
        text: row.extract.text,
        dryRun: config.dryRun,
      });
      if (summary.skip) {
        markSeen(seen, {
          id: row.item.id,
          url: row.item.url,
          title: row.item.title,
          source: row.item.source,
          status: 'skipped',
        });
        continue;
      }
      sendable.push(summary);
    } catch (err) {
      console.warn(`summarize failed for ${row.item.id}:`, err);
    }
  }

  if (sendable.length === 0) {
    saveSeen(config.seenPath, seen);
    return;
  }

  const heading = formatDigestHeading();
  const header = formatHeader({
    emoji: heading.emoji,
    label: heading.label,
    when: heading.when,
    count: sendable.length,
  });

  let sentCount = 0;
  try {
    sentCount = await sendDigestMessages({
      botToken: config.telegramBotToken,
      chatId: config.telegramChatId,
      header,
      articles: sendable.map((summary) => ({
        text: formatArticle(summary),
        replyMarkup: buildArticleKeyboard(summary),
      })),
      dryRun: config.dryRun,
    });
  } catch (err) {
    const partial =
      typeof err === 'object' && err && 'sentCount' in err
        ? Number((err as { sentCount?: number }).sentCount ?? 0)
        : 0;
    sentCount = Number.isFinite(partial) ? partial : 0;
    for (let i = 0; i < sentCount; i++) {
      const summary = sendable[i]!;
      markSeen(seen, {
        id: summary.item.id,
        url: summary.item.url,
        title: summary.item.title,
        source: summary.item.source,
        status: 'sent',
        at: nowIso(),
      });
    }
    saveSeen(config.seenPath, seen);
    throw err;
  }

  for (const summary of sendable.slice(0, sentCount)) {
    markSeen(seen, {
      id: summary.item.id,
      url: summary.item.url,
      title: summary.item.title,
      source: summary.item.source,
      status: 'sent',
      at: nowIso(),
    });
  }
  saveSeen(config.seenPath, seen);
  console.log(`Digest sent: ${sentCount} articles`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Dry-run smoke test**

Run: `DRY_RUN=1 npm run digest`  
Expected: exit 0; logs fetch/selection; may send nothing if filter yields 0

- [ ] **Step 3: Run full unit tests**

Run: `npm test`  
Expected: all vitest tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire end-to-end digest orchestration"
```

---

### Task 12: GitHub Actions workflow + README

**Files:**
- Create: `.github/workflows/digest.yml`
- Create: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Create `.github/workflows/digest.yml`**

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
        run: npm run digest

      - name: Commit seen state
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add state/seen.json
          if git diff --staged --quiet; then
            echo "No state changes"
            exit 0
          fi
          git commit -m "chore(state): update seen.json [skip ci]"
          git pull --rebase origin "${{ github.ref_name }}"
          git push
```

- [ ] **Step 2: Create `.env.example`**

```dotenv
TELEGRAM_BOT_TOKEN=123456:ABCDEF
TELEGRAM_CHAT_ID=123456789
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-1.5-flash
DRY_RUN=1
```

- [ ] **Step 3: Replace `README.md` with setup docs**

```markdown
# news-bot

Personal curated software-engineering reading digest delivered to Telegram via GitHub Actions.

## What it does

1. Fetches RSS feeds + Hacker News
2. Filters for SE-relevant topics (AI/tooling, interviews, system design, etc.)
3. Cleans article text and summarizes with Gemini Flash
4. Sends a timed digest to Telegram (header + one message per article)
5. Commits `state/seen.json` so articles are not resent

## Setup

1. Create a Telegram bot with BotFather and note the token
2. DM the bot, then get your chat id
3. Get a Gemini API key
4. In the GitHub repo settings, add secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `GEMINI_API_KEY`
5. Edit `config/sources.yaml` and `config/topics.yaml`

## Local run

```bash
cp .env.example .env
# fill real values, or keep DRY_RUN=1
export $(grep -v '^#' .env | xargs)
npm install
npm test
npm run digest
```

## Schedule

Workflow: `.github/workflows/digest.yml`

- 07:00 / 12:00 / 19:00 Asia/Ho_Chi_Minh
- Manual: Actions → Reading Digest → Run workflow

## Docs

- Design: `docs/superpowers/specs/2026-09-24-curated-news-digest-bot-design.md`
- Plan: `docs/superpowers/plans/2026-09-24-curated-news-digest-bot.md`
```

- [ ] **Step 4: Final verification**

Run: `npm test`  
Expected: PASS

Run: `DRY_RUN=1 npm run digest`  
Expected: exits 0

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/digest.yml .env.example README.md
git commit -m "chore: add Actions workflow and setup docs"
```

---

## Self-Review (plan vs spec)

| Spec requirement | Task coverage |
|---|---|
| Actions-only cron + dispatch | Task 12 |
| TS/Node 20 monolith pipeline | Tasks 1, 11 |
| `state/seen.json` + statuses `sent`/`skipped`/`extract_failed` | Tasks 3, 11 |
| RSS + HN fetch | Task 7 |
| SE allow/deny scoring + top K | Task 5 |
| Readability + truncate | Task 8 |
| Gemini Flash JSON summary ≤~300 tokens | Task 9 |
| Telegram HTML + URL buttons + header/article | Tasks 6, 10, 11 |
| Commit state in workflow with `[skip ci]` | Task 12 |
| Free-tier runtime tactics (cache, timeout, early exit) | Tasks 11–12 |
| Unit tests for rank + format (+ seen) | Tasks 3, 5, 6 |

**Placeholder scan:** no TBD/TODO left in actionable steps.  
**Type consistency:** shared `RawItem` / `RankedItem` / `ArticleSummary` / `SeenStore` from `src/fetchers/types.ts` used across modules.

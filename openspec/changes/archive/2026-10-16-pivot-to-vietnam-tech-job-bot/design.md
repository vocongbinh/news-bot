# Design

## Context

The repository contains an existing, functioning GitHub Actions automation pipeline written in TypeScript (Node.js 20). The pipeline runs on scheduled cron triggers, maintains state via `state/seen.json` committed to the repository, uses Google Gemini Flash for LLM generation, and delivers messages to Telegram using the Telegram Bot API.

Our goal is to pivot this pipeline from SE news aggregation to a Vietnam Tech Job Alert Bot targeting major global tech multinationals. Because GitHub Actions runners operate on public cloud datacenter IP ranges (Azure), aggressive anti-bot platforms (such as LinkedIn and TopCV) block direct scraping. Conversely, public ATS REST endpoints (Greenhouse, SmartRecruiters, Workday, BambooHR) and server-rendered portals like ITviec provide unblocked, reliable, structured data feeds.

## Goals / Non-Goals

**Goals:**
- Provide reliable, zero-maintenance job ingestion from 5 primary ATS/portal sources: Greenhouse, SmartRecruiters, Workday, BambooHR, and ITviec.
- Track 20+ top-tier global tech multinationals with tech presence or remote/hybrid hiring in Vietnam.
- Filter and rank roles specifically for Software Engineer, Backend, Fullstack, and AI Agent/Engineer disciplines.
- Use Gemini Flash to generate a 3-bullet structured summary (Tech Stack, Core Requirements, Highlights) for each matched role.
- Dispatch clean, formatted job cards to Telegram with direct application links.
- Prevent duplicate alerts within a 30-day rolling window using `state/seen.json`.
- Execute completely within free-tier GitHub Actions run limits (runtime < 2 minutes per execution).

**Non-Goals:**
- Scrape authwalled or captcha-gated platforms (LinkedIn guest pages, TopCV Cloudflare Turnstile) directly on GitHub Actions.
- Provide interactive Telegram callback handlers or maintain a 24/7 listening bot server.
- Store data in external cloud databases (PostgreSQL, Supabase, Cloudflare D1); repository-committed JSON remains the storage mechanism.
- Auto-apply or submit resumes on behalf of the user.

## Decisions

### 1. Data Model: Unified Job Representation

To decouple ingestion adapters from downstream filtering, summarization, and formatting, every provider adapter normalizes its payload to `NormalizedJob`:

```typescript
export interface NormalizedJob {
  id: string;               // Deterministic key: `${provider}:${company}:${rawId}`
  provider: 'greenhouse' | 'smartrecruiters' | 'workday' | 'bamboohr' | 'itviec';
  company: string;          // Display company name (e.g., "Thoughtworks", "NAB")
  title: string;            // Official job title
  location: string;         // Normalised location text (e.g., "Ho Chi Minh City, Vietnam", "Remote")
  url: string;              // Direct application URL
  description?: string;     // Clean text/markdown JD body (for Gemini summarization)
  postedAt?: string;        // ISO 8601 timestamp or relative string
  tags?: string[];          // Skills/categories extracted from provider metadata
}
```

### 2. Provider Adapter Architecture

Each provider implements a standard functional contract:
`export async function fetchJobs(company: CompanyConfig): Promise<NormalizedJob[]>`

- **Greenhouse (`src/fetchers/greenhouse.ts`):**
  - Endpoint: `https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true`
  - Filters by location containing Vietnam, Ho Chi Minh, Hanoi, or Da Nang.
- **SmartRecruiters (`src/fetchers/smartrecruiters.ts`):**
  - Endpoint: `https://api.smartrecruiters.com/v1/companies/{company_id}/postings`
  - Filters by `location.country === 'vn'` or location city containing Vietnam cities.
- **Workday (`src/fetchers/workday.ts`):**
  - Endpoint: `POST https://{subdomain}.wd3.myworkdayjobs.com/wday/cxs/{company}/{portal}/jobs`
  - Payload: `{"appliedFacets":{},"limit":20,"offset":0,"searchText":"Vietnam"}`.
- **BambooHR (`src/fetchers/bamboohr.ts`):**
  - Endpoint: `GET https://{subdomain}.bamboohr.com/careers/list` with `Accept: application/json`.
  - Filters by location country/city for Vietnam.
- **ITviec (`src/fetchers/itviec.ts`):**
  - Endpoint: `https://itviec.com/companies/{company_slug}`
  - Parses server-rendered HTML job cards (`.job-card`) to extract title, slug, location, and salary info.

### 3. Configuration Architecture

Replace `config/sources.yaml` with two human-editable YAML files:

#### `config/companies.yaml`:
```yaml
companies:
  - name: "Thoughtworks"
    provider: "greenhouse"
    token: "thoughtworks"
    priority: 1
  - name: "NAB Innovation Centre Vietnam"
    provider: "workday"
    subdomain: "nab"
    companyId: "nab"
    portal: "nab_careers"
    priority: 1
  - name: "SMG Swiss Marketplace Group"
    provider: "smartrecruiters"
    companyId: "SMGSwissMarketplaceGroup"
    priority: 1
  - name: "LeapXpert"
    provider: "bamboohr"
    subdomain: "leapxpert"
    priority: 1
  - name: "Employment Hero"
    provider: "itviec"
    slug: "employment-hero"
    priority: 1
  - name: "Grab"
    provider: "smartrecruiters"
    companyId: "Grab"
    priority: 1
  - name: "Axon"
    provider: "greenhouse"
    token: "axon"
    priority: 1
  - name: "WorldQuant"
    provider: "greenhouse"
    token: "worldquant"
    priority: 1
```

#### `config/roles.yaml`:
```yaml
roles:
  include:
    - pattern: "software\\s*engineer|developer"
      category: "software-engineer"
    - pattern: "backend|back-end|api|server"
      category: "backend"
    - pattern: "fullstack|full-stack"
      category: "fullstack"
    - pattern: "ai\\s*engineer|ai\\s*agent|machine\\s*learning|ml\\s*engineer|llm"
      category: "ai-agent"
  exclude:
    - "sales"
    - "civil"
    - "mechanical"
    - "hr\\b"
    - "recruiter"
    - "marketing"
    - "accountant"
    - "legal"
```

### 4. LLM Prompt Strategy for Gemini Flash

Instead of news article summarization, the prompt instructs Gemini to output 3 structured lines:
```text
Role: {title} at {company}
Location: {location}
Description: {cleanDescription}

Instructions:
Extract exactly 3 concise, high-value bullet points in Vietnamese or English:
1. Tech Stack: Core programming languages, frameworks, cloud platforms, and databases.
2. Requirements: Key experience level, architectural focus (microservices, distributed systems, etc.).
3. Perks & Mode: Remote/hybrid policy, compensation range if mentioned, and standout team highlights.
Keep total output under 120 words.
```

### 5. Telegram Card Formatting

Each alert card includes:
- Company and Role header with emojis (`🏢 Thoughtworks`, `💼 Senior Fullstack Engineer`)
- Location badge (`📍 Ho Chi Minh City (Hybrid)`)
- 3-bullet AI summary
- Inline URL Button: `[🚀 Apply on Company Site]`

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **ATS endpoint schema changes** | Isolate each provider in its own module with unit tests against recorded sample JSON. If one provider fails, fault-tolerant ingestion ensures other companies continue uninterrupted. |
| **Workday search API rate limits** | Limit search queries to 1 page (top 20 newest jobs) per company per run; cache seen IDs so subsequent runs only process deltas. |
| **Gemini API quota or transient errors** | If Gemini summarization fails, fall back gracefully to displaying the raw job title, location, and tags without breaking the notification pipeline. |
| **Missed listings from unconfigured companies** | ITviec parser and extensible `companies.yaml` allow adding new MNCs simply by editing the YAML configuration without touching TypeScript code. |

# Tasks

## 1. Foundation & Configuration

- [x] 1.1 Define unified data types (`NormalizedJob`, `CompanyConfig`, `RoleConfig`) in `src/fetchers/types.ts`.
- [x] 1.2 Create `config/companies.yaml` with the comprehensive directory of global tech MNCs in Vietnam mapped to their ATS providers (Greenhouse, Workday, SmartRecruiters, BambooHR, ITviec).
- [x] 1.3 Create `config/roles.yaml` with inclusion patterns (Software Engineer, Backend, Fullstack, AI Agent) and negative exclusion filters.
- [x] 1.4 Update `src/config.ts` to parse and validate `companies.yaml` and `roles.yaml`.

## 2. ATS & Portal Ingestion Adapters

- [x] 2.1 Implement Greenhouse adapter (`src/fetchers/greenhouse.ts`) filtering by Vietnam location.
- [x] 2.2 Implement SmartRecruiters adapter (`src/fetchers/smartrecruiters.ts`) filtering by Vietnam location.
- [x] 2.3 Implement Workday adapter (`src/fetchers/workday.ts`) with keyword search and pagination.
- [x] 2.4 Implement BambooHR adapter (`src/fetchers/bamboohr.ts`) for company career boards.
- [x] 2.5 Implement ITviec adapter (`src/fetchers/itviec.ts`) parsing server-rendered job cards.
- [x] 2.6 Implement unified ingestion orchestrator (`src/fetchers/index.ts`) with concurrency limit and error isolation.
- [x] 2.7 Add unit tests for all provider adapters in `tests/fetchers/` using recorded fixture responses.

## 3. Matching & Ranking Engine

- [x] 3.1 Implement role pattern matcher and negative keyword exclusions in `src/filter/matcher.ts`.
- [x] 3.2 Implement geographic and remote/hybrid verification in `src/filter/matcher.ts`.
- [x] 3.3 Implement priority weighting logic ensuring primary target companies appear first.
- [x] 3.4 Add unit tests covering role matching, exclusion edge cases, and ranking in `tests/filter/matcher.test.ts`.

## 4. AI Summarization & Telegram Delivery

- [x] 4.1 Update Gemini Flash prompt in `src/summarize/prompt.ts` to extract exactly 3 bullets (Tech Stack, Core Requirements, Highlights).
- [x] 4.2 Update `src/summarize/gemini.ts` with error handling and fallback to raw metadata if LLM times out.
- [x] 4.3 Refactor `src/telegram/format.ts` to generate formatted Job Alert cards with inline "Apply on Company Site" URL buttons.
- [x] 4.4 Update Telegram formatting unit tests in `tests/telegram/format.test.ts`.

## 5. Pipeline Orchestration & End-to-End Verification

- [x] 5.1 Rewire `src/main.ts` to execute: Ingestion -> Seen Deduplication -> Matching -> Gemini Summarization -> Telegram Dispatch.
- [x] 5.2 Remove obsolete news dependencies and files (`src/fetchers/rss.ts`, `src/fetchers/hn.ts`, `src/extract/readability.ts`, `config/sources.yaml`, `config/topics.yaml`).
- [x] 5.3 Run Vitest test suite (`npm test`) and resolve all test regressions.
- [x] 5.4 Execute a live dry-run of `npm run digest` to verify end-to-end fetching from live MNC ATS endpoints.

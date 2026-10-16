# Proposal

## Why

The current bot aggregates generic software engineering news from RSS and Hacker News. However, the user needs an automated, high-precision daily job monitoring tool that actively tracks new tech openings in Vietnam—specifically Software Engineer, Backend Engineer, Fullstack Engineer, and AI Agent/Engineer positions—at leading global tech multinationals (such as Employment Hero, Thoughtworks, NAB, SMG, LeapXpert, Grab, Axon, WorldQuant) and alerts them via Telegram before roles close or saturate.

## What Changes

- **BREAKING**: Replaced news RSS and Hacker News fetchers with ATS API adapters (Greenhouse, Workday, SmartRecruiters, BambooHR) and an ITviec parser.
- **BREAKING**: Replaced news topic configuration (`config/topics.yaml`, `config/sources.yaml`) with structured company directories (`config/companies.yaml`) and role criteria (`config/roles.yaml`).
- **Added**: ATS ingestion clients for major recruitment platforms that provide public, unauthenticated JSON endpoints with zero Cloudflare/anti-bot blocks.
- **Added**: Unified job normalization pipeline converting disparate ATS schemas into a standard `NormalizedJob` format.
- **Added**: Role and seniority matching engine filtering for Software, Backend, Fullstack, and AI Agent/Engineer roles.
- **Added**: Gemini Flash job summarizer extracting 3 concise bullets (Tech Stack, Core Requirements, Highlights/Perks) per matching role.
- **Modified**: Telegram formatting to deliver clean job alert cards with direct apply links and source tags.
- **Preserved**: GitHub Actions daily cron runner and `seen.json` deduplication engine (avoiding duplicate alerts within 30 days).

## Capabilities

### New Capabilities
- `job-ingestion`: Fetching active job postings across multiple ATS platforms (Greenhouse, Workday, SmartRecruiters, BambooHR) and ITviec, normalizing them into a unified job schema.
- `job-matching`: Filtering normalized jobs by target roles (Software, Backend, Fullstack, AI Agent), seniority levels, and target locations (Vietnam, HCMC, Hanoi, Remote).
- `job-delivery`: Summarizing matched jobs with Gemini Flash, formatting interactive Telegram alert cards, and recording notified jobs to prevent repeat alerts.

### Modified Capabilities
<!-- No prior OpenSpec capabilities existed in this repository. -->

## Impact

- **Source Code**:
  - `src/fetchers/`: Replaced with `src/fetchers/greenhouse.ts`, `src/fetchers/workday.ts`, `src/fetchers/smartrecruiters.ts`, `src/fetchers/bamboohr.ts`, `src/fetchers/itviec.ts`.
  - `src/filter/`: Replaced `rank.ts` with `matcher.ts` tailored for role keywords, seniority, and company priority.
  - `src/summarize/`: Replaced news prompt in `prompt.ts` with structured JD analysis prompt for Gemini Flash.
  - `src/telegram/`: Replaced article cards in `format.ts` with job cards (Company, Role, Location, Tech Tags, Apply Link).
  - `src/main.ts`: End-to-end orchestrator adapted for job ingestion, deduplication, matching, summarization, and dispatch.
- **Configuration**:
  - `config/companies.yaml`: Directory of global tech MNCs mapped to their respective ATS providers and tokens.
  - `config/roles.yaml`: Role matching rules, seniority filters, and exclusion keywords.
- **Dependencies**: Replaced `rss-parser` and `@mozilla/readability` with lightweight HTTP fetchers and HTML parser (`cheerio` or built-in regex/jsdom for ITviec).

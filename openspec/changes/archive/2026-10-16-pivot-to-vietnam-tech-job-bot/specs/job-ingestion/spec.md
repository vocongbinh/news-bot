# Spec Delta

## Purpose

The job-ingestion capability fetches active job postings from multiple Applicant Tracking System (ATS) providers and job portals for configured companies and normalizes them into a unified job schema.

## ADDED Requirements

### Requirement: Multi-Provider ATS Ingestion
The system SHALL ingest open roles from configured companies using provider-specific adapters for Greenhouse, SmartRecruiters, Workday, BambooHR, and ITviec without requiring authenticated user sessions.

#### Scenario: Fetching from Greenhouse board
- **WHEN** the company configuration specifies provider `greenhouse` with a valid board token
- **THEN** the system queries the Greenhouse public board API and retrieves all active jobs for that board

#### Scenario: Fetching from SmartRecruiters
- **WHEN** the company configuration specifies provider `smartrecruiters` with a company identifier
- **THEN** the system queries the SmartRecruiters postings API and retrieves matching active jobs

#### Scenario: Fetching from Workday
- **WHEN** the company configuration specifies provider `workday` with an endpoint and search keyword
- **THEN** the system posts to the Workday CXS jobs search endpoint and retrieves paginated job postings

#### Scenario: Fetching from BambooHR
- **WHEN** the company configuration specifies provider `bamboohr` with a subdomain
- **THEN** the system requests the BambooHR careers list endpoint and retrieves the open positions

#### Scenario: Fetching from ITviec
- **WHEN** the company configuration specifies provider `itviec` with a company slug
- **THEN** the system fetches the ITviec company profile page and parses server-rendered job cards

### Requirement: Unified Job Normalization
The system SHALL normalize raw responses from all supported providers into a standard `NormalizedJob` record containing `id`, `provider`, `company`, `title`, `location`, `url`, `description`, and `postedAt`.

#### Scenario: Mapping unique job identity
- **WHEN** jobs are normalized from any provider
- **THEN** the `id` field is deterministically prefixed with the provider name and company key (e.g. `greenhouse:thoughtworks:7916649`) to guarantee uniqueness across providers

#### Scenario: Location extraction
- **WHEN** a raw job includes location text or facets
- **THEN** the normalized `location` preserves city and remote/hybrid indicators for downstream filtering

### Requirement: Fault-Tolerant Provider Execution
The system SHALL isolate individual provider failures so that an error or timeout from one company endpoint does not terminate the remaining ingestion tasks.

#### Scenario: Single company endpoint failure
- **WHEN** an ATS endpoint returns an HTTP 5xx error or exceeds a 10-second timeout
- **THEN** the system logs the failure with the company name, skips the failed source, and continues ingesting from all other configured companies

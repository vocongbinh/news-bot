# job-delivery Specification

## Purpose
The job-delivery capability summarizes candidate jobs with Gemini Flash, formats structured Telegram alert cards with interactive action buttons, and manages deduplication state to prevent repeated alerts.

## Requirements

### Requirement: AI-Powered Job Description Summarization
The system SHALL use Gemini Flash to analyze the job description of each candidate role and extract a structured 3-bullet summary covering tech stack, key requirements, and highlights.

#### Scenario: Successful JD analysis
- **WHEN** a job description is submitted to the Gemini Flash summarizer
- **THEN** the model returns exactly 3 concise bullet points: (1) Primary tech stack and tools, (2) Core experience and technical requirements, (3) Highlights including remote/hybrid status, compensation, or benefits

#### Scenario: LLM failure fallback
- **WHEN** the Gemini API returns a rate limit error or fails to respond
- **THEN** the system falls back to a plain title and location preview without halting the delivery pipeline

### Requirement: State Deduplication and Retention
The system SHALL maintain a persistent record of previously alerted job identifiers in `state/seen.json` and suppress duplicate alerts for 30 days.

#### Scenario: Suppressing previously notified job
- **WHEN** an ingested job ID matches an entry in `seen.json` recorded within the last 30 days
- **THEN** the system discards the job before LLM summarization and message dispatch

#### Scenario: Recording newly notified jobs
- **WHEN** a job message is successfully transmitted to Telegram
- **THEN** the system records the job ID and current timestamp into `seen.json` and prunes records older than 30 days

### Requirement: Telegram Alert Card Formatting
The system SHALL format each matched job into a Telegram message card featuring company name, role title, location badge, AI summary, and an inline URL button for direct application.

#### Scenario: Constructing job card message
- **WHEN** a candidate job with an AI summary is prepared for dispatch
- **THEN** the message includes the role title as header, the company name and location as metadata, the 3 summary bullets, and an inline keyboard button labeled "Apply on Company Site" targeting the job URL

### Requirement: Telegram Rate Limiting and Batching
The system SHALL throttle message dispatch to respect Telegram Bot API rate limits (maximum 30 messages per second globally and 1 per second per chat).

#### Scenario: Dispatching multiple job alerts
- **WHEN** multiple job alerts are queued for transmission
- **THEN** the system introduces an inter-message delay (minimum 1000ms) between successive Telegram API calls to prevent 429 Too Many Requests responses

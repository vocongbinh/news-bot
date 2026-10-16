# Spec Delta

## Purpose

The job-matching capability evaluates normalized job postings against target role keywords, seniority levels, geographic filters, and company priority tiers to produce a ranked list of candidate roles.

## ADDED Requirements

### Requirement: Role and Title Matching
The system SHALL match job postings against configured target role profiles including Software Engineer, Backend Engineer, Fullstack Engineer, and AI Agent/Engineer.

#### Scenario: Matching standard tech role
- **WHEN** a job title contains "Senior Full-Stack Engineer"
- **THEN** the system classifies the job as a match under the "fullstack" role category

#### Scenario: Matching AI agent and AI engineering roles
- **WHEN** a job title contains "AI Ops Engineer", "AI Engineer", or "AI Agent Developer"
- **THEN** the system classifies the job as a match under the "ai-agent" role category

### Requirement: Negative Keyword Exclusion
The system SHALL discard postings that contain non-software or non-engineering keywords even if partial target keywords are present.

#### Scenario: Excluding non-software roles
- **WHEN** a job title contains "Sales Engineer", "Civil Engineer", "HR Specialist", or "Recruiter"
- **THEN** the system rejects the job and excludes it from downstream delivery

### Requirement: Geographic and Remote Filtering
The system SHALL retain only jobs located in Vietnam (such as Ho Chi Minh City, Hanoi, Da Nang) or explicitly marked as Remote/Hybrid accessible from Vietnam.

#### Scenario: Vietnam location confirmation
- **WHEN** a job location includes "Vietnam", "Ho Chi Minh", "Hanoi", or "Da Nang"
- **THEN** the system accepts the posting as geographically valid

#### Scenario: Foreign-only location rejection
- **WHEN** a global ATS posting lists locations exclusively in foreign cities (e.g. "Sydney, Australia" or "Zurich, Switzerland") without Vietnam or Global Remote options
- **THEN** the system discards the job from the candidate list

### Requirement: Priority Tier Ranking
The system SHALL rank matched jobs by company priority tier, ensuring roles from primary target companies appear first in the daily digest.

#### Scenario: Prioritizing primary MNCs
- **WHEN** jobs from Employment Hero, Thoughtworks, NAB, SMG, or LeapXpert match role criteria
- **THEN** the system assigns them top priority rank ahead of secondary or unlisted companies

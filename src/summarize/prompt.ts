import type { JobMatch } from '../fetchers/types.ts';

export const JOB_SYSTEM_PROMPT = `You are a staff software engineer and technical recruiter analyzing tech job postings in Vietnam.
Analyze the provided job title, company, location, and description.
Extract exactly 3 concise, high-value bullet points in Vietnamese or English:
1. techStack: Core programming languages, frameworks, cloud platforms, databases, and libraries.
2. requirements: Experience level, system scale, architectural depth (e.g., microservices, event-driven, distributed systems).
3. highlights: Work mode (Remote/Hybrid/Office), standout benefits, team culture, or compensation indicators if available.

Output MUST be valid JSON with keys:
- "techStack": string
- "requirements": string
- "highlights": string
- "bullets": array of 3 strings corresponding to the 3 items above

Keep each point under 25 words. No marketing fluff.`;

export function buildJobPrompt(match: JobMatch): string {
  const job = match.job;
  const descriptionSnippet = job.description
    ? job.description.slice(0, 3000)
    : 'No full description provided. Infer from title and tags.';

  return [
    `Company: ${job.company}`,
    `Role Title: ${job.title}`,
    `Location: ${job.location}`,
    `Tags: ${job.tags?.join(', ') ?? 'None'}`,
    '',
    'Job Description:',
    descriptionSnippet,
    '',
    'Return JSON with keys: techStack, requirements, highlights, bullets.',
  ].join('\n');
}

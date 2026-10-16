import { GoogleGenerativeAI } from '@google/generative-ai';
import type { JobMatch, JobSummary } from '../fetchers/types.ts';
import { JOB_SYSTEM_PROMPT, buildJobPrompt } from './prompt.ts';

interface ModelJobJson {
  techStack?: string;
  requirements?: string;
  highlights?: string;
  bullets?: string[];
}

export async function summarizeJob(input: {
  apiKey: string;
  model: string;
  match: JobMatch;
  dryRun?: boolean;
}): Promise<JobSummary> {
  const { match, dryRun, apiKey, model } = input;
  const job = match.job;

  if (dryRun) {
    const techStack = job.tags?.length ? job.tags.join(', ') : 'Software Engineering & Cloud';
    const requirements = `Matching categories: ${match.categories.join(', ')}`;
    const highlights = `${job.location} · Verified MNC posting`;
    return {
      match,
      techStack,
      requirements,
      highlights,
      bullets: [
        `Tech: ${techStack}`,
        `Requirements: ${requirements}`,
        `Highlights: ${highlights}`,
      ],
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({
      model,
      systemInstruction: JOB_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 350,
        responseMimeType: 'application/json',
      },
    });

    const result = await generativeModel.generateContent(buildJobPrompt(match));
    const raw = result.response.text();
    const parsed = JSON.parse(raw) as ModelJobJson;

    const techStack = parsed.techStack?.trim() || job.tags?.join(', ') || 'Software Architecture & Development';
    const requirements = parsed.requirements?.trim() || `Experienced in ${match.categories.join(', ')}`;
    const highlights = parsed.highlights?.trim() || job.location;

    const bullets = Array.isArray(parsed.bullets) && parsed.bullets.length === 3
      ? parsed.bullets.map((b) => b.trim())
      : [
          `Tech: ${techStack}`,
          `Requirements: ${requirements}`,
          `Highlights: ${highlights}`,
        ];

    return {
      match,
      techStack,
      requirements,
      highlights,
      bullets,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Gemini] Warning: summarization fallback for ${job.title}: ${msg}`);
    const techStack = job.tags?.length ? job.tags.join(', ') : 'Software Engineering';
    const requirements = `Matching categories: ${match.categories.join(', ')}`;
    const highlights = `${job.location} · Direct Company Application`;
    return {
      match,
      techStack,
      requirements,
      highlights,
      bullets: [
        `Tech: ${techStack}`,
        `Requirements: ${requirements}`,
        `Highlights: ${highlights}`,
      ],
    };
  }
}

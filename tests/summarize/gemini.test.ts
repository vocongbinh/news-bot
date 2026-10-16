import { describe, expect, it } from 'vitest';
import type { JobMatch } from '../../src/fetchers/types.ts';
import { summarizeJob } from '../../src/summarize/gemini.ts';

describe('Gemini Summarizer', () => {
  const match: JobMatch = {
    job: {
      id: 'greenhouse:tw:123',
      provider: 'greenhouse',
      company: 'Thoughtworks',
      title: 'Senior Fullstack Engineer',
      location: 'Ho Chi Minh City, Vietnam',
      url: 'https://example.com/apply',
      tags: ['TypeScript', 'React', 'Node.js'],
      description: 'Building modern microservices and high-scale systems.',
    },
    categories: ['fullstack', 'backend'],
    priority: 115,
  };

  it('generates structured summary in dry-run mode', async () => {
    const summary = await summarizeJob({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
      match,
      dryRun: true,
    });

    expect(summary.match.job.company).toBe('Thoughtworks');
    expect(summary.techStack).toContain('TypeScript');
    expect(summary.requirements).toContain('fullstack');
    expect(summary.highlights).toContain('Ho Chi Minh City');
    expect(summary.bullets).toHaveLength(3);
  });

  it('falls back gracefully on API failure', async () => {
    const summary = await summarizeJob({
      apiKey: 'invalid-key',
      model: 'nonexistent-model',
      match,
      dryRun: false,
    });

    expect(summary.match.job.company).toBe('Thoughtworks');
    expect(summary.techStack).toBeDefined();
    expect(summary.requirements).toBeDefined();
    expect(summary.highlights).toBeDefined();
  });
});

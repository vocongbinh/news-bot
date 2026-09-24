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

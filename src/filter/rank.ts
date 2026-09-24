import type { TopicsConfig } from '../config.ts';
import type { RankedItem, RawItem, SeenStore } from '../fetchers/types.ts';
import { shouldConsider } from '../state/seen.ts';

function normalize(text: string): string {
  return text.toLowerCase();
}

function keywordHits(text: string, keywords: string[]): number {
  const hay = normalize(text);
  let hits = 0;
  for (const kw of keywords) {
    if (hay.includes(kw.toLowerCase())) hits += 1;
  }
  return hits;
}

function recencyBoost(publishedAt: string | undefined, max: number): number {
  if (!publishedAt) return 0;
  const ageHours = (Date.now() - Date.parse(publishedAt)) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours < 0) return 0;
  if (ageHours <= 6) return max;
  if (ageHours <= 24) return Math.ceil(max / 2);
  if (ageHours <= 72) return 1;
  return 0;
}

export function scoreItem(
  item: RawItem,
  topics: TopicsConfig,
  sourceWeights: Record<string, number>,
): number {
  const text = `${item.title}\n${item.snippet ?? ''}`;
  const denyHits = keywordHits(text, topics.denyKeywords);
  if (denyHits > 0) {
    return -topics.weights.denyHit * denyHits;
  }
  const sourceKey = item.source.startsWith('rss:')
    ? item.source.slice(4)
    : item.source;
  const sourceWeight = sourceWeights[sourceKey] ?? sourceWeights[item.source] ?? 5;
  const allowHits = keywordHits(text, topics.allowKeywords);
  const pointsBoost = item.points
    ? Math.min(6, item.points / topics.weights.hnPointsDivisor)
    : 0;
  return (
    sourceWeight +
    allowHits * topics.weights.keywordHit +
    recencyBoost(item.publishedAt, topics.weights.recencyMax) +
    pointsBoost
  );
}

export function rankItems(
  items: RawItem[],
  seen: SeenStore,
  topics: TopicsConfig,
  sourceWeights: Record<string, number>,
): RankedItem[] {
  const ranked: RankedItem[] = [];
  for (const item of items) {
    if (!shouldConsider(seen, item.id)) continue;
    const score = scoreItem(item, topics, sourceWeights);
    if (score < topics.minScore) continue;
    ranked.push({ ...item, score });
  }
  ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return ranked.slice(0, topics.topK);
}

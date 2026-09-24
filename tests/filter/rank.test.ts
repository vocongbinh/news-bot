import { describe, expect, it } from 'vitest';
import { rankItems } from '../../src/filter/rank.ts';
import type { RawItem, SeenStore } from '../../src/fetchers/types.ts';
import type { TopicsConfig } from '../../src/config.ts';

const topics: TopicsConfig = {
  topK: 2,
  minScore: 6,
  truncateChars: 5000,
  allowKeywords: ['system design', 'leetcode', 'typescript'],
  denyKeywords: ['celebrity', 'bitcoin price'],
  weights: {
    keywordHit: 3,
    recencyMax: 4,
    hnPointsDivisor: 25,
    denyHit: 20,
  },
};

function item(partial: Partial<RawItem> & Pick<RawItem, 'id' | 'title'>): RawItem {
  return {
    url: `https://example.com/${partial.id}`,
    source: 'hn',
    publishedAt: new Date().toISOString(),
    points: 50,
    ...partial,
  };
}

describe('rankItems', () => {
  it('drops hard-deny items and keeps SE-relevant topK', () => {
    const seen: SeenStore = { version: 1, updatedAt: '', items: {} };
    const ranked = rankItems(
      [
        item({ id: '1', title: 'Celebrity gossip roundup' }),
        item({ id: '2', title: 'System design for TypeScript services' }),
        item({ id: '3', title: 'LeetCode patterns for interviews' }),
        item({ id: '4', title: 'Random gardening tips' }),
      ],
      seen,
      topics,
      { hn: 8 },
    );
    expect(ranked.map((r) => r.id)).toEqual(['2', '3']);
  });

  it('skips already-sent ids but retries extract_failed', () => {
    const seen: SeenStore = {
      version: 1,
      updatedAt: '',
      items: {
        '2': {
          url: 'u',
          title: 't',
          source: 'hn',
          seenAt: '2026-09-01T00:00:00+07:00',
          status: 'sent',
        },
        '3': {
          url: 'u3',
          title: 't3',
          source: 'hn',
          seenAt: '2026-09-01T00:00:00+07:00',
          status: 'extract_failed',
        },
      },
    };
    const ranked = rankItems(
      [
        item({ id: '2', title: 'System design deep dive' }),
        item({ id: '3', title: 'LeetCode interview guide' }),
      ],
      seen,
      topics,
      { hn: 8 },
    );
    expect(ranked.map((r) => r.id)).toEqual(['3']);
  });
});

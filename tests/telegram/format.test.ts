import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  formatHeader,
  formatArticle,
  buildArticleKeyboard,
} from '../../src/telegram/format.ts';
import type { ArticleSummary } from '../../src/fetchers/types.ts';

describe('telegram format', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('A <B> & C')).toBe('A &lt;B&gt; &amp; C');
  });

  it('formats header and article payloads', () => {
    const summary: ArticleSummary = {
      skip: false,
      topicTags: ['system-design', 'interview'],
      readingMinutes: 8,
      bullets: ['One <trick>', 'Two', 'Three'],
      keyInsight: 'Trade-offs beat slogans.',
      item: {
        id: 'hn:1',
        url: 'https://example.com/a',
        title: 'Design & Scale',
        source: 'hn',
        score: 12,
        discussionUrl: 'https://news.ycombinator.com/item?id=1',
      },
    };

    const header = formatHeader({
      emoji: '☀️',
      label: 'Morning Digest',
      when: 'Thu 24 Sep, 07:00 ICT',
      count: 1,
    });
    expect(header).toContain('<b>Morning Digest</b>');
    expect(header).toContain('<code>1 picks</code>');

    const body = formatArticle(summary);
    expect(body).toContain('<b>Design &amp; Scale</b>');
    expect(body).toContain('• One &lt;trick&gt;');
    expect(body).toContain('Key insight');

    const keyboard = buildArticleKeyboard(summary);
    expect(keyboard).toEqual({
      inline_keyboard: [
        [
          { text: 'Read article', url: 'https://example.com/a' },
          { text: 'HN discussion', url: 'https://news.ycombinator.com/item?id=1' },
        ],
      ],
    });
  });
});

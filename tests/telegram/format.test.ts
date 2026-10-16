import { describe, expect, it } from 'vitest';
import type { JobSummary } from '../../src/fetchers/types.ts';
import {
  buildJobKeyboard,
  escapeHtml,
  formatJobCard,
  formatJobHeader,
} from '../../src/telegram/format.ts';

describe('telegram job format', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('C++ & <Java>')).toBe('C++ &amp; &lt;Java&gt;');
  });

  it('formats header and job cards accurately', () => {
    const summary: JobSummary = {
      match: {
        job: {
          id: 'workday:nab:123',
          provider: 'workday',
          company: 'NAB Innovation Centre Vietnam',
          title: 'Senior Full-Stack Engineer <ECOM>',
          location: 'Hanoi, Vietnam (Hybrid)',
          url: 'https://nab.example.com/apply',
        },
        categories: ['fullstack', 'backend'],
        priority: 120,
      },
      techStack: 'React, Node.js, AWS & Docker',
      requirements: '5+ years experience with microservices',
      highlights: 'Hybrid work model, travel opportunities to Australia',
      bullets: [],
    };

    const header = formatJobHeader({
      when: 'Fri 16 Oct, 08:00 ICT',
      count: 1,
    });
    expect(header).toContain('Vietnam Tech Job Alert');
    expect(header).toContain('1 cơ hội tuyển dụng MNC');

    const card = formatJobCard(summary);
    expect(card).toContain('<b>NAB Innovation Centre Vietnam</b>');
    expect(card).toContain('Senior Full-Stack Engineer &lt;ECOM&gt;');
    expect(card).toContain('<code>#fullstack</code>');
    expect(card).toContain('<code>#backend</code>');
    expect(card).toContain('React, Node.js, AWS &amp; Docker');

    const keyboard = buildJobKeyboard(summary);
    expect(keyboard).toEqual({
      inline_keyboard: [
        [
          {
            text: '🚀 Ứng tuyển ngay (Apply)',
            url: 'https://nab.example.com/apply',
          },
        ],
      ],
    });
  });
});

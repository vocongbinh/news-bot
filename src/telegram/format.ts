import type { ArticleSummary } from '../fetchers/types.ts';

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function formatHeader(input: {
  emoji: string;
  label: string;
  when: string;
  count: number;
}): string {
  return [
    `${input.emoji} <b>${escapeHtml(input.label)}</b> · ${escapeHtml(input.when)}`,
    `<code>${input.count} picks</code> for software engineers`,
  ].join('\n');
}

export function formatArticle(summary: ArticleSummary): string {
  const tags = summary.topicTags
    .slice(0, 3)
    .map((t) => `<b>${escapeHtml(t)}</b>`)
    .join(' · ');
  const bullets = summary.bullets
    .slice(0, 5)
    .map((b) => `• ${escapeHtml(b)}`)
    .join('\n');
  return [
    `🏷 ${tags}  ·  ⏱ ${summary.readingMinutes} min`,
    `<b>${escapeHtml(summary.item.title)}</b>`,
    '',
    bullets,
    '',
    `💡 <i>Key insight: ${escapeHtml(summary.keyInsight)}</i>`,
  ].join('\n');
}

export function buildArticleKeyboard(summary: ArticleSummary): {
  inline_keyboard: { text: string; url: string }[][];
} {
  const row: { text: string; url: string }[] = [
    { text: 'Read article', url: summary.item.url },
  ];
  if (summary.item.discussionUrl) {
    row.push({ text: 'HN discussion', url: summary.item.discussionUrl });
  }
  return { inline_keyboard: [row] };
}

import type { JobSummary } from '../fetchers/types.ts';

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function formatJobHeader(input: {
  when: string;
  count: number;
}): string {
  return [
    `🎯 <b>Vietnam Tech Job Alert</b> · ${escapeHtml(input.when)}`,
    `<code>${input.count} cơ hội tuyển dụng MNC</code> cho Software & AI Engineers:`,
  ].join('\n');
}

export function formatJobCard(summary: JobSummary): string {
  const job = summary.match.job;
  const categoriesText = summary.match.categories
    .map((c) => `<code>#${escapeHtml(c)}</code>`)
    .join(' ');

  return [
    `🏢 <b>${escapeHtml(job.company)}</b> · 📍 <i>${escapeHtml(job.location)}</i>`,
    `💼 <b>${escapeHtml(job.title)}</b>`,
    categoriesText ? `🏷 ${categoriesText}` : '',
    '',
    `🛠 <b>Tech Stack:</b> ${escapeHtml(summary.techStack)}`,
    `🎯 <b>Yêu cầu:</b> ${escapeHtml(summary.requirements)}`,
    `🌟 <b>Đãi ngộ & Chế độ:</b> ${escapeHtml(summary.highlights)}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

export function buildJobKeyboard(summary: JobSummary): {
  inline_keyboard: { text: string; url: string }[][];
} {
  const row: { text: string; url: string }[] = [
    { text: '🚀 Ứng tuyển ngay (Apply)', url: summary.match.job.url },
  ];
  return { inline_keyboard: [row] };
}

import { JSDOM } from 'jsdom';
import { fetchText } from '../util/http.ts';
import type { ItviecCompanyConfig, NormalizedJob } from './types.ts';

export async function fetchItviecJobs(
  config: ItviecCompanyConfig,
  customFetchText = fetchText,
): Promise<NormalizedJob[]> {
  const url = `https://itviec.com/companies/${config.slug}`;
  const html = await customFetchText(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
    },
  });

  const dom = new JSDOM(html);
  const document = dom.window.document;
  const jobCards = document.querySelectorAll('.job-card');

  const results: NormalizedJob[] = [];
  for (const card of Array.from(jobCards)) {
    // Look for link with href starting with /it-jobs/
    const linkEl = card.querySelector('a[href^="/it-jobs/"]');
    if (!linkEl) continue;

    const href = linkEl.getAttribute('href') ?? '';
    const cleanPath = href.split('?')[0];
    const rawId = cleanPath.replace('/it-jobs/', '');
    const title = linkEl.textContent?.trim() ?? '';

    // Check posted time
    const postedEl = card.querySelector('.small-text.text-dark-grey');
    const postedText = postedEl?.textContent?.replace(/\s+/g, ' ').trim();

    // Check salary or tags
    const tags: string[] = [];
    const tagEls = card.querySelectorAll('.itag, .job-tag');
    for (const tagEl of Array.from(tagEls)) {
      const text = tagEl.textContent?.trim();
      if (text) tags.push(text);
    }

    if (title && cleanPath) {
      results.push({
        id: `itviec:${config.slug}:${rawId}`,
        provider: 'itviec',
        company: config.name,
        title,
        location: 'Vietnam',
        url: `https://itviec.com${cleanPath}`,
        postedAt: postedText,
        tags: tags.length > 0 ? tags : undefined,
      });
    }
  }

  return results;
}

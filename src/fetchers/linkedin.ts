import { JSDOM } from 'jsdom';
import { fetchText } from '../util/http.ts';
import type { LinkedInCompanyConfig, NormalizedJob } from './types.ts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isForeignOrTargetCompany(
  companyName: string,
  allowCompanies?: string[],
  blockCompanies?: string[],
): boolean {
  const lower = companyName.toLowerCase().trim();
  if (!lower) return false;

  if (blockCompanies && blockCompanies.length > 0) {
    for (const pattern of blockCompanies) {
      if (new RegExp(pattern, 'i').test(lower)) {
        return false;
      }
    }
  }

  if (allowCompanies && allowCompanies.length > 0) {
    return allowCompanies.some((pattern) => new RegExp(pattern, 'i').test(lower));
  }

  return true;
}

export function parseLinkedInGuestHtml(
  html: string,
  config: LinkedInCompanyConfig,
): NormalizedJob[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const cards = document.querySelectorAll('.base-search-card, li');

  const results: NormalizedJob[] = [];
  const seenIds = new Set<string>();

  for (const card of Array.from(cards)) {
    const titleEl = card.querySelector('.base-search-card__title');
    const companyEl = card.querySelector('.base-search-card__subtitle');
    const locationEl = card.querySelector('.job-search-card__location');
    const linkEl = card.querySelector('a.base-card__full-link, a[href*="/jobs/view/"]');
    const timeEl = card.querySelector('time');

    const title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const company = companyEl?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const location = locationEl?.textContent?.replace(/\s+/g, ' ').trim() ?? config.location;
    const rawHref = linkEl?.getAttribute('href') ?? '';

    if (!title || !company || !rawHref) continue;

    if (!isForeignOrTargetCompany(company, config.allowCompanies, config.blockCompanies)) {
      continue;
    }

    const cleanUrl = rawHref.split('?')[0] ?? rawHref;
    const idMatch = cleanUrl.match(/(\d+)\/?$/) ?? card.getAttribute('data-entity-urn')?.match(/(\d+)$/);
    const rawId = idMatch?.[1] ?? cleanUrl.replace(/[^a-zA-Z0-9]/g, '').slice(-24);
    const id = `linkedin:${rawId}`;

    if (seenIds.has(id)) continue;
    seenIds.add(id);

    results.push({
      id,
      provider: 'linkedin',
      company,
      title,
      location,
      url: cleanUrl,
      postedAt: timeEl?.getAttribute('datetime') ?? timeEl?.textContent?.trim(),
      tags: ['LinkedIn', 'MNC/Foreign'],
    });
  }

  return results;
}

export async function fetchLinkedInJobs(
  config: LinkedInCompanyConfig,
  customFetchText = fetchText,
): Promise<NormalizedJob[]> {
  const keywordsList = config.keywords.length > 0 ? config.keywords : ['Software Engineer'];
  const location = config.location || 'Ho Chi Minh City, Vietnam';
  const timePosted = config.timePosted ?? 'r86400'; // Last 24 hours by default
  const experienceLevels = config.experienceLevels ?? '2,3'; // Entry & Associate (2-4 YOE)
  const delayMs = config.delayMs ?? 1200;

  const allJobs: NormalizedJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < keywordsList.length; i++) {
    const kw = keywordsList[i]!;
    const params = new URLSearchParams({
      keywords: kw,
      location,
      f_TPR: timePosted,
      start: '0',
    });
    if (experienceLevels) {
      params.set('f_E', experienceLevels);
    }

    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
    try {
      const html = await customFetchText(url, {
        headers: {
          'accept-language': 'en-US,en;q=0.9',
        },
      });
      const parsed = parseLinkedInGuestHtml(html, config);
      for (const job of parsed) {
        if (!seenIds.has(job.id)) {
          seenIds.add(job.id);
          allJobs.push(job);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[LinkedIn] Warning: query "${kw}" failed: ${msg}`);
    }

    if (i < keywordsList.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return allJobs;
}

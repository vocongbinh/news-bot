import { fetchJson } from '../util/http.ts';
import type { AshbyCompanyConfig, NormalizedJob } from './types.ts';

interface AshbyRawJob {
  id: string;
  title: string;
  location?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  jobUrl: string;
  publishedAt?: string;
  descriptionPlain?: string;
  address?: {
    postalAddress?: {
      addressLocality?: string;
      addressCountry?: string;
    };
  };
}

interface AshbyBoardResponse {
  jobs?: AshbyRawJob[];
}

const VN_LOCATION_REGEX = /vietnam|viet nam|ho chi minh|hcmc|\bhcm\b|hanoi|ha noi|da nang|saigon/i;

export async function fetchAshbyJobs(
  config: AshbyCompanyConfig,
  customFetchJson = fetchJson,
): Promise<NormalizedJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${config.slug}`;
  const data = await customFetchJson<AshbyBoardResponse>(url);

  if (!data?.jobs || !Array.isArray(data.jobs)) {
    return [];
  }

  const results: NormalizedJob[] = [];
  for (const raw of data.jobs) {
    const locParts = [
      raw.location ?? '',
      raw.address?.postalAddress?.addressLocality ?? '',
      raw.address?.postalAddress?.addressCountry ?? '',
    ].filter(Boolean);
    const locCombined = locParts.join(', ');

    if (!VN_LOCATION_REGEX.test(locCombined)) {
      continue;
    }

    results.push({
      id: `ashby:${config.slug}:${raw.id}`,
      provider: 'ashby',
      company: config.name,
      title: raw.title.trim(),
      location: raw.location || locCombined || 'Vietnam',
      url: raw.jobUrl,
      description: raw.descriptionPlain?.slice(0, 3000),
      postedAt: raw.publishedAt,
      tags: [raw.department, raw.team, raw.employmentType].filter((t): t is string => Boolean(t)),
    });
  }

  return results;
}

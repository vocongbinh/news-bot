import { fetchJson } from '../util/http.ts';
import type { LeverCompanyConfig, NormalizedJob } from './types.ts';

interface LeverRawJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  country?: string;
  categories?: {
    location?: string;
    allLocations?: string[];
    department?: string;
    team?: string;
    commitment?: string;
  };
  descriptionPlain?: string;
}

const VN_LOCATION_REGEX = /vietnam|viet nam|ho chi minh|hcmc|\bhcm\b|hanoi|ha noi|da nang|saigon/i;

export async function fetchLeverJobs(
  config: LeverCompanyConfig,
  customFetchJson = fetchJson,
): Promise<NormalizedJob[]> {
  const url = `https://api.lever.co/v0/postings/${config.slug}?mode=json`;
  const data = await customFetchJson<LeverRawJob[]>(url);

  if (!Array.isArray(data)) {
    return [];
  }

  const results: NormalizedJob[] = [];
  for (const raw of data) {
    const locations = [
      raw.categories?.location ?? '',
      ...(raw.categories?.allLocations ?? []),
      raw.country ?? '',
    ]
      .filter(Boolean)
      .join(', ');

    if (!VN_LOCATION_REGEX.test(locations)) {
      continue;
    }

    results.push({
      id: `lever:${config.slug}:${raw.id}`,
      provider: 'lever',
      company: config.name,
      title: raw.text.trim(),
      location: raw.categories?.location || locations || 'Vietnam',
      url: raw.hostedUrl,
      description: raw.descriptionPlain?.slice(0, 3000),
      postedAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
      tags: [raw.categories?.department, raw.categories?.team, raw.categories?.commitment].filter(
        (t): t is string => Boolean(t),
      ),
    });
  }

  return results;
}

import { fetchJson } from '../util/http.ts';
import type { GreenhouseCompanyConfig, NormalizedJob } from './types.ts';

interface GreenhouseRawJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  content?: string;
  departments?: Array<{ name: string }>;
}

interface GreenhouseBoardResponse {
  jobs: GreenhouseRawJob[];
}

const VN_LOCATION_REGEX = /vietnam|viet nam|ho chi minh|hanoi|ha noi|da nang|saigon/i;

export async function fetchGreenhouseJobs(
  config: GreenhouseCompanyConfig,
  customFetchJson = fetchJson,
): Promise<NormalizedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${config.token}/jobs?content=true`;
  const data = await customFetchJson<GreenhouseBoardResponse>(url);

  if (!data?.jobs || !Array.isArray(data.jobs)) {
    return [];
  }

  const results: NormalizedJob[] = [];
  for (const raw of data.jobs) {
    const loc = raw.location?.name ?? '';
    const isVn = VN_LOCATION_REGEX.test(loc);
    const isRemote = /remote/i.test(loc) && !/united states|europe|americas|latam/i.test(loc);

    if (isVn || isRemote) {
      results.push({
        id: `greenhouse:${config.token}:${raw.id}`,
        provider: 'greenhouse',
        company: config.name,
        title: raw.title.trim(),
        location: loc || 'Vietnam (Remote/Hybrid)',
        url: raw.absolute_url,
        description: raw.content ? raw.content.replace(/<[^>]+>/g, ' ').slice(0, 3000) : undefined,
        postedAt: raw.updated_at,
        tags: raw.departments?.map((d) => d.name),
      });
    }
  }

  return results;
}

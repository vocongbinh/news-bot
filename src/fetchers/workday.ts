import { postJson } from '../util/http.ts';
import type { NormalizedJob, WorkdayCompanyConfig } from './types.ts';

interface WorkdayRawJob {
  title: string;
  externalPath: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}

interface WorkdaySearchResponse {
  total?: number;
  jobPostings?: WorkdayRawJob[];
}

const PAGE_SIZE = 20;
const MAX_PAGES = 5;

export async function fetchWorkdayJobs(
  config: WorkdayCompanyConfig,
  customPostJson = postJson,
): Promise<NormalizedJob[]> {
  const url = `https://${config.subdomain}.wd3.myworkdayjobs.com/wday/cxs/${config.companyId}/${config.portal}/jobs`;
  const results: NormalizedJob[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const payload = {
      appliedFacets: {},
      limit: PAGE_SIZE,
      offset,
      searchText: 'Vietnam',
    };

    const data = await customPostJson<WorkdaySearchResponse>(url, payload);

    if (!data?.jobPostings || !Array.isArray(data.jobPostings) || data.jobPostings.length === 0) {
      break;
    }

    for (const raw of data.jobPostings) {
      const rawId = raw.externalPath.split('_').pop() ?? raw.externalPath.replace(/[^a-zA-Z0-9]/g, '');
      const cleanUrl = `https://${config.subdomain}.wd3.myworkdayjobs.com/en-US/${config.portal}${raw.externalPath}`;

      results.push({
        id: `workday:${config.companyId}:${rawId}`,
        provider: 'workday',
        company: config.name,
        title: raw.title.trim(),
        location: raw.locationsText ?? 'Vietnam',
        url: cleanUrl,
        postedAt: raw.postedOn,
        tags: raw.bulletFields,
      });
    }

    const total = data.total ?? data.jobPostings.length;
    if (offset + data.jobPostings.length >= total || data.jobPostings.length < PAGE_SIZE) {
      break;
    }
  }

  return results;
}

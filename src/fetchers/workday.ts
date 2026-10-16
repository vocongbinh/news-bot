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

export async function fetchWorkdayJobs(
  config: WorkdayCompanyConfig,
  customPostJson = postJson,
): Promise<NormalizedJob[]> {
  const url = `https://${config.subdomain}.wd3.myworkdayjobs.com/wday/cxs/${config.companyId}/${config.portal}/jobs`;
  const payload = {
    appliedFacets: {},
    limit: 20,
    offset: 0,
    searchText: 'Vietnam',
  };

  const data = await customPostJson<WorkdaySearchResponse>(url, payload);

  if (!data?.jobPostings || !Array.isArray(data.jobPostings)) {
    return [];
  }

  const results: NormalizedJob[] = [];
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

  return results;
}

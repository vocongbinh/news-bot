import { fetchJson } from '../util/http.ts';
import type { BambooHrCompanyConfig, NormalizedJob } from './types.ts';

interface BambooRawJob {
  id: string;
  jobOpeningName: string;
  departmentLabel?: string;
  employmentStatusLabel?: string;
  location?: {
    city?: string | null;
    state?: string | null;
  };
  atsLocation?: {
    country?: string | null;
    city?: string | null;
  };
  isRemote?: boolean | null;
}

interface BambooResponse {
  result?: BambooRawJob[];
}

const VN_LOC_REGEX = /vietnam|viet nam|ho chi minh|hanoi|ha noi|da nang|saigon/i;

export async function fetchBambooHrJobs(
  config: BambooHrCompanyConfig,
  customFetchJson = fetchJson,
): Promise<NormalizedJob[]> {
  const url = `https://${config.subdomain}.bamboohr.com/careers/list`;
  const data = await customFetchJson<BambooResponse>(url, {
    headers: { accept: 'application/json' },
  });

  if (!data?.result || !Array.isArray(data.result)) {
    return [];
  }

  const results: NormalizedJob[] = [];
  for (const raw of data.result) {
    const city = raw.location?.city ?? raw.atsLocation?.city ?? '';
    const country = raw.atsLocation?.country ?? '';
    const isVn = VN_LOC_REGEX.test(city) || VN_LOC_REGEX.test(country) || VN_LOC_REGEX.test(raw.jobOpeningName);
    const isRemote = raw.isRemote === true || /remote/i.test(city) || /remote/i.test(raw.jobOpeningName);

    // Accept if in Vietnam, or remote, or if no country specified for an international engineering role
    if (isVn || isRemote || raw.departmentLabel?.toLowerCase().includes('engineering')) {
      const locationText = [city, country].filter(Boolean).join(', ') || 'Remote / Vietnam';
      results.push({
        id: `bamboohr:${config.subdomain}:${raw.id}`,
        provider: 'bamboohr',
        company: config.name,
        title: raw.jobOpeningName.trim(),
        location: locationText,
        url: `https://${config.subdomain}.bamboohr.com/careers/${raw.id}`,
        tags: [raw.departmentLabel, raw.employmentStatusLabel].filter((t): t is string => Boolean(t)),
      });
    }
  }

  return results;
}

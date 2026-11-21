import { fetchJson } from '../util/http.ts';
import type { NormalizedJob, SmartRecruitersCompanyConfig } from './types.ts';

interface SmartRecruitersRawJob {
  id: string;
  name: string;
  releasedDate?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  department?: { label?: string };
  function?: { label?: string };
}

interface SmartRecruitersResponse {
  totalFound?: number;
  content?: SmartRecruitersRawJob[];
}

const VN_CITY_REGEX = /vietnam|viet nam|ho chi minh|hcm|hanoi|ha noi|da nang|saigon/i;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

export async function fetchSmartRecruitersJobs(
  config: SmartRecruitersCompanyConfig,
  customFetchJson = fetchJson,
): Promise<NormalizedJob[]> {
  const results: NormalizedJob[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const url = `https://api.smartrecruiters.com/v1/companies/${config.companyId}/postings?country=vn&limit=${PAGE_SIZE}&offset=${offset}`;
    const data = await customFetchJson<SmartRecruitersResponse>(url);

    if (!data?.content || !Array.isArray(data.content) || data.content.length === 0) {
      break;
    }

    for (const raw of data.content) {
      const loc = raw.location;
      const country = loc?.country?.toLowerCase() ?? '';
      const city = loc?.city ?? '';
      const isVnCountry = country === 'vn' || country === 'vnm';
      const isVnCity = VN_CITY_REGEX.test(city);
      const isVnTitle = VN_CITY_REGEX.test(raw.name);
      const isRemote = loc?.remote === true && (isVnCountry || isVnCity || isVnTitle);

      if (isVnCountry || isVnCity || isVnTitle || isRemote) {
        const locationText = [city, country ? country.toUpperCase() : ''].filter(Boolean).join(', ') || 'Vietnam';
        results.push({
          id: `smartrecruiters:${config.companyId}:${raw.id}`,
          provider: 'smartrecruiters',
          company: config.name,
          title: raw.name.trim(),
          location: locationText,
          url: `https://jobs.smartrecruiters.com/${config.companyId}/${raw.id}`,
          postedAt: raw.releasedDate,
          tags: [raw.department?.label, raw.function?.label].filter((t): t is string => Boolean(t)),
        });
      }
    }

    const totalFound = data.totalFound ?? data.content.length;
    if (offset + data.content.length >= totalFound || data.content.length < PAGE_SIZE) {
      break;
    }
  }

  return results;
}

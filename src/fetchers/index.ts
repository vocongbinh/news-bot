import { fetchBambooHrJobs } from './bamboohr.ts';
import { fetchGreenhouseJobs } from './greenhouse.ts';
import { fetchItviecJobs } from './itviec.ts';
import { fetchSmartRecruitersJobs } from './smartrecruiters.ts';
import type { CompanyConfig, NormalizedJob } from './types.ts';
import { fetchWorkdayJobs } from './workday.ts';

export async function fetchCompanyJobs(company: CompanyConfig): Promise<NormalizedJob[]> {
  try {
    switch (company.provider) {
      case 'greenhouse':
        return await fetchGreenhouseJobs(company);
      case 'smartrecruiters':
        return await fetchSmartRecruitersJobs(company);
      case 'workday':
        return await fetchWorkdayJobs(company);
      case 'bamboohr':
        return await fetchBambooHrJobs(company);
      case 'itviec':
        return await fetchItviecJobs(company);
      default:
        console.warn(`[Fetcher] Unsupported provider for ${(company as CompanyConfig).name}`);
        return [];
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Fetcher] Warning: failed to fetch jobs for ${company.name} (${company.provider}): ${msg}`);
    return [];
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export async function fetchAllCompanyJobs(
  companies: CompanyConfig[],
  concurrency = 3,
): Promise<NormalizedJob[]> {
  const nested = await mapLimit(companies, concurrency, async (company) => {
    return await fetchCompanyJobs(company);
  });
  return nested.flat();
}

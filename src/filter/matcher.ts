import type { CompanyConfig, JobMatch, NormalizedJob, RoleConfig } from '../fetchers/types.ts';

const VN_LOC_PATTERN = /vietnam|viet nam|ho chi minh|hanoi|ha noi|da nang|saigon|remote/i;
const FOREIGN_ONLY_PATTERN = /\b(united states|usa|chicago|san francisco|london|sydney|melbourne|zurich|berlin|tokyo)\b/i;

export function isLocationValid(location: string): boolean {
  if (!location) return true; // Default to true if not specified
  if (VN_LOC_PATTERN.test(location)) return true;
  if (FOREIGN_ONLY_PATTERN.test(location)) return false;
  return false;
}

export function matchJob(
  job: NormalizedJob,
  roles: RoleConfig,
  companyPriority = 2,
): JobMatch | null {
  const titleLower = job.title.toLowerCase();

  // 1. Negative keyword exclusions
  for (const excludeTerm of roles.exclude) {
    const regex = new RegExp(`\\b${excludeTerm}\\b`, 'i');
    if (regex.test(titleLower)) {
      return null;
    }
  }

  // 2. Inclusion pattern matching
  const matchedCategories = new Set<string>();
  const searchCorpus = `${job.title} ${job.tags?.join(' ') ?? ''}`;

  for (const rule of roles.include) {
    const regex = new RegExp(rule.pattern, 'i');
    if (regex.test(searchCorpus)) {
      matchedCategories.add(rule.category);
    }
  }

  if (matchedCategories.size === 0) {
    return null;
  }

  // 3. Location / Remote validation
  if (!isLocationValid(job.location)) {
    return null;
  }

  // 4. Priority and relevance scoring
  // Priority 1: 100 base, Priority 2: 50 base, others: 10 base
  let score = companyPriority === 1 ? 100 : companyPriority === 2 ? 50 : 10;
  score += matchedCategories.size * 15;

  // Bonus if specifically mentions Senior/Lead/Principal or AI
  if (/senior|lead|principal|staff/i.test(titleLower)) {
    score += 10;
  }
  if (matchedCategories.has('ai-agent')) {
    score += 20;
  }

  return {
    job,
    categories: Array.from(matchedCategories),
    priority: score,
  };
}

export function matchAndRankJobs(
  jobs: NormalizedJob[],
  roles: RoleConfig,
  companies: CompanyConfig[],
): JobMatch[] {
  const priorityMap = new Map<string, number>();
  for (const comp of companies) {
    priorityMap.set(comp.name.toLowerCase(), comp.priority ?? 2);
  }

  const matches: JobMatch[] = [];
  for (const job of jobs) {
    const priority = priorityMap.get(job.company.toLowerCase()) ?? 2;
    const match = matchJob(job, roles, priority);
    if (match) {
      matches.push(match);
    }
  }

  // Sort by priority score descending
  return matches.sort((a, b) => b.priority - a.priority);
}

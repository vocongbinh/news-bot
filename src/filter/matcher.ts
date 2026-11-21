import type { CompanyConfig, JobMatch, NormalizedJob, RoleConfig } from '../fetchers/types.ts';

const DEFAULT_HCM_PATTERN = /ho chi minh|hcmc|\bhcm\b|saigon|sài gòn|tp\.?\s*hcm/i;
const NON_HCM_VN_PATTERN = /\b(hanoi|ha noi|hà nội|da nang|đà nẵng|hai phong|can tho|hue)\b/i;
const GENERIC_VN_PATTERN = /\b(vietnam|viet nam)\b/i;
const FOREIGN_ONLY_PATTERN = /\b(united states|usa|chicago|san francisco|london|sydney|melbourne|zurich|berlin|tokyo|singapore|malaysia|indonesia|philippines|thailand|india|bangalore|austin|raleigh|seattle|scottsdale)\b/i;

const DEFAULT_EXCLUDE_LEVELS = [
  'intern',
  'internship',
  'fresher',
  'trainee',
  'co-op',
  'senior',
  'sr\\.',
  'lead',
  'principal',
  'staff',
  'architect',
  'manager',
  'director',
  'head of',
  '\\bvp\\b',
  'vice president',
  'chief',
  'distinguished',
];

const MID_JUNIOR_BONUS_PATTERN = /\b(junior|jr\.?|middle|mid-?level|mid|associate|engineer\s+i{1,2}|developer\s+i{1,2}|level\s+[123])\b/i;

export function isLocationValid(location: string, allowedLocations?: string[]): boolean {
  if (!location) return false;

  if (allowedLocations && allowedLocations.length > 0) {
    const customPattern = new RegExp(allowedLocations.join('|'), 'i');
    if (customPattern.test(location)) return true;
  } else if (DEFAULT_HCM_PATTERN.test(location)) {
    return true;
  }

  // Reject explicitly non-HCM Vietnam cities (e.g. Hanoi, Da Nang)
  if (NON_HCM_VN_PATTERN.test(location)) {
    return false;
  }

  // Reject foreign-only locations
  if (FOREIGN_ONLY_PATTERN.test(location)) {
    return false;
  }

  // Allow generic "Vietnam" only when provider didn't specify a city (e.g. ITviec)
  if (GENERIC_VN_PATTERN.test(location) && !NON_HCM_VN_PATTERN.test(location)) {
    return true;
  }

  return false;
}

export function isLevelAllowed(title: string, excludeLevels?: string[]): boolean {
  const levels = excludeLevels ?? DEFAULT_EXCLUDE_LEVELS;
  for (const levelTerm of levels) {
    const hasCustomBoundary = levelTerm.includes('\\b') || levelTerm.endsWith('\\.');
    const regex = hasCustomBoundary
      ? new RegExp(levelTerm, 'i')
      : new RegExp(`\\b${levelTerm}\\b`, 'i');
    if (regex.test(title)) {
      return false;
    }
  }
  return true;
}

export function matchJob(
  job: NormalizedJob,
  roles: RoleConfig,
  companyPriority = 2,
): JobMatch | null {
  const titleLower = job.title.toLowerCase();

  // 1. Negative keyword exclusions
  for (const excludeTerm of roles.exclude) {
    const endsWithNonWord = /[^a-zA-Z0-9]$/.test(excludeTerm);
    const regex = endsWithNonWord
      ? new RegExp(`(?<![a-zA-Z0-9])${excludeTerm}(?![a-zA-Z0-9])`, 'i')
      : new RegExp(`\\b${excludeTerm}\\b`, 'i');
    if (regex.test(titleLower)) {
      return null;
    }
  }

  // 2. Seniority / level filtering (target Junior & Middle, ~3 YOE)
  if (!isLevelAllowed(job.title, roles.excludeLevels)) {
    return null;
  }

  // 3. Inclusion pattern matching
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

  // 4. Location validation (HCM focus)
  if (!isLocationValid(job.location, roles.locations)) {
    return null;
  }

  // 5. Priority and relevance scoring
  // Priority 1: 100 base, Priority 2: 50 base, others: 10 base
  let score = companyPriority === 1 ? 100 : companyPriority === 2 ? 50 : 10;
  score += matchedCategories.size * 15;

  // Bonus if specifically mentions Junior/Middle/Mid-level/Associate/Engineer I-II or AI
  if (MID_JUNIOR_BONUS_PATTERN.test(titleLower)) {
    score += 15;
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

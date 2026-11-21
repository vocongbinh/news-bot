export type AtsProvider =
  | 'greenhouse'
  | 'smartrecruiters'
  | 'workday'
  | 'bamboohr'
  | 'itviec'
  | 'lever'
  | 'ashby'
  | 'linkedin';

export interface BaseCompanyConfig {
  name: string;
  provider: AtsProvider;
  priority?: number; // 1 = highest, defaults to 2
}

export interface GreenhouseCompanyConfig extends BaseCompanyConfig {
  provider: 'greenhouse';
  token: string;
}

export interface SmartRecruitersCompanyConfig extends BaseCompanyConfig {
  provider: 'smartrecruiters';
  companyId: string;
}

export interface WorkdayCompanyConfig extends BaseCompanyConfig {
  provider: 'workday';
  subdomain: string;
  companyId: string;
  portal: string;
}

export interface BambooHrCompanyConfig extends BaseCompanyConfig {
  provider: 'bamboohr';
  subdomain: string;
}

export interface ItviecCompanyConfig extends BaseCompanyConfig {
  provider: 'itviec';
  slug: string;
}

export interface LeverCompanyConfig extends BaseCompanyConfig {
  provider: 'lever';
  slug: string;
}

export interface AshbyCompanyConfig extends BaseCompanyConfig {
  provider: 'ashby';
  slug: string;
}

export interface LinkedInCompanyConfig extends BaseCompanyConfig {
  provider: 'linkedin';
  location: string;
  keywords: string[];
  timePosted?: string; // e.g. r86400 (24h), r604800 (7d)
  experienceLevels?: string; // e.g. "2,3" (Entry & Associate)
  delayMs?: number;
  allowCompanies?: string[];
  blockCompanies?: string[];
}

export type CompanyConfig =
  | GreenhouseCompanyConfig
  | SmartRecruitersCompanyConfig
  | WorkdayCompanyConfig
  | BambooHrCompanyConfig
  | ItviecCompanyConfig
  | LeverCompanyConfig
  | AshbyCompanyConfig
  | LinkedInCompanyConfig;

export interface NormalizedJob {
  id: string; // Deterministic format: `${provider}:${companyKey}:${rawId}`
  provider: AtsProvider;
  company: string;
  title: string;
  location: string;
  url: string;
  description?: string;
  postedAt?: string;
  tags?: string[];
}

export interface RolePattern {
  pattern: string;
  category: string;
}

export interface RoleConfig {
  locations?: string[];
  excludeLevels?: string[];
  include: RolePattern[];
  exclude: string[];
}

export interface JobMatch {
  job: NormalizedJob;
  categories: string[];
  priority: number;
}

export interface JobSummary {
  match: JobMatch;
  techStack: string;
  requirements: string;
  highlights: string;
  bullets: string[];
}

export type SeenStatus = 'sent' | 'skipped';

export interface SeenItem {
  url: string;
  title: string;
  source: string;
  seenAt: string;
  digestAt?: string;
  status: SeenStatus;
}

export interface SeenStore {
  version: 1;
  updatedAt: string;
  items: Record<string, SeenItem>;
}

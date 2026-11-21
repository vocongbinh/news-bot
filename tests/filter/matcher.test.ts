import { describe, expect, it } from 'vitest';
import type { CompanyConfig, NormalizedJob, RoleConfig } from '../../src/fetchers/types.ts';
import {
  isLevelAllowed,
  isLocationValid,
  matchAndRankJobs,
  matchJob,
} from '../../src/filter/matcher.ts';

const mockRoles: RoleConfig = {
  locations: ['ho chi minh', 'hcmc', '\\bhcm\\b', 'saigon'],
  excludeLevels: ['intern', 'fresher', 'senior', 'sr\\.', 'lead', 'principal', 'staff', 'manager', 'director'],
  include: [
    { pattern: 'software\\s+engineer|developer', category: 'software-engineer' },
    { pattern: 'backend|node|python|java', category: 'backend' },
    { pattern: 'fullstack|full-stack', category: 'fullstack' },
    { pattern: 'ai\\s*(?:agent|engineer|ops)', category: 'ai-agent' },
  ],
  exclude: ['embedded', 'automotive', 'c\\+\\+', 'sales', 'civil', 'hr', 'recruiter', 'marketing'],
};

const mockCompanies: CompanyConfig[] = [
  { name: 'Thoughtworks', provider: 'greenhouse', token: 'thoughtworks', priority: 1 },
  { name: 'Grab', provider: 'smartrecruiters', companyId: 'Grab', priority: 1 },
  { name: 'TymeX', provider: 'greenhouse', token: 'tymex', priority: 2 },
];

describe('Job Matcher', () => {
  it('identifies and classifies valid Junior/Middle tech roles in HCM', () => {
    const job: NormalizedJob = {
      id: 'job-1',
      provider: 'greenhouse',
      company: 'Thoughtworks',
      title: 'Middle Full-Stack Engineer (Node.js/React)',
      location: 'Ho Chi Minh City, Vietnam',
      url: 'https://example.com/1',
    };

    const match = matchJob(job, mockRoles, 1);
    expect(match).not.toBeNull();
    expect(match?.categories).toContain('fullstack');
    expect(match?.categories).toContain('backend');
    expect(match?.priority).toBeGreaterThan(100);
  });

  it('matches AI agent and AI engineering roles in HCM with bonus points', () => {
    const job: NormalizedJob = {
      id: 'job-ai',
      provider: 'workday',
      company: 'NAB',
      title: 'AI Ops Engineer',
      location: 'HCMC, Vietnam',
      url: 'https://example.com/ai',
    };

    const match = matchJob(job, mockRoles, 1);
    expect(match).not.toBeNull();
    expect(match?.categories).toContain('ai-agent');
    expect(match?.priority).toBeGreaterThan(120);
  });

  it('excludes Intern/Fresher and Senior/Lead/Principal/Manager roles', () => {
    expect(isLevelAllowed('Software Engineer Intern', mockRoles.excludeLevels)).toBe(false);
    expect(isLevelAllowed('Fresher Backend Developer', mockRoles.excludeLevels)).toBe(false);
    expect(isLevelAllowed('Senior Software Engineer', mockRoles.excludeLevels)).toBe(false);
    expect(isLevelAllowed('Lead Software Engineer', mockRoles.excludeLevels)).toBe(false);
    expect(isLevelAllowed('Principal Software Engineer', mockRoles.excludeLevels)).toBe(false);
    expect(isLevelAllowed('Staff Software Engineer', mockRoles.excludeLevels)).toBe(false);
    expect(isLevelAllowed('Engineering Manager', mockRoles.excludeLevels)).toBe(false);

    expect(isLevelAllowed('Software Engineer, Backend', mockRoles.excludeLevels)).toBe(true);
    expect(isLevelAllowed('Junior Backend Developer', mockRoles.excludeLevels)).toBe(true);
    expect(isLevelAllowed('Middle Fullstack Engineer', mockRoles.excludeLevels)).toBe(true);
    expect(isLevelAllowed('Android Engineer I', mockRoles.excludeLevels)).toBe(true);
  });

  it('excludes non-engineering roles even if partial keywords match', () => {
    const job: NormalizedJob = {
      id: 'job-sales',
      provider: 'itviec',
      company: 'Company A',
      title: 'Sales Engineer for Enterprise Products',
      location: 'Ho Chi Minh City',
      url: 'https://example.com/sales',
    };

    const match = matchJob(job, mockRoles);
    expect(match).toBeNull();

    const cppJob: NormalizedJob = {
      id: 'job-cpp',
      provider: 'greenhouse',
      company: 'OPSWAT',
      title: 'Software Engineer C++',
      location: 'Ho Chi Minh City, Vietnam',
      url: 'https://example.com/cpp',
    };
    expect(matchJob(cppJob, mockRoles)).toBeNull();

    const embeddedJob: NormalizedJob = {
      id: 'job-emb',
      provider: 'smartrecruiters',
      company: 'Bosch',
      title: 'Embedded Automotive Software Engineer',
      location: 'Ho Chi Minh, VN',
      url: 'https://example.com/emb',
    };
    expect(matchJob(embeddedJob, mockRoles)).toBeNull();
  });

  it('accepts HCM locations and rejects Hanoi, Da Nang, and foreign locations', () => {
    expect(isLocationValid('Ho Chi Minh City, Vietnam', mockRoles.locations)).toBe(true);
    expect(isLocationValid('HCMC, VN', mockRoles.locations)).toBe(true);
    expect(isLocationValid('Saigon', mockRoles.locations)).toBe(true);
    expect(isLocationValid('Vietnam', mockRoles.locations)).toBe(true);

    expect(isLocationValid('Hanoi, Vietnam', mockRoles.locations)).toBe(false);
    expect(isLocationValid('Da Nang, Vietnam', mockRoles.locations)).toBe(false);
    expect(isLocationValid('Chicago, United States', mockRoles.locations)).toBe(false);
    expect(isLocationValid('Singapore', mockRoles.locations)).toBe(false);
    expect(isLocationValid('APAC Remote', mockRoles.locations)).toBe(false);
  });

  it('sorts matched jobs by priority and relevance descending', () => {
    const jobs: NormalizedJob[] = [
      {
        id: 'job-tier2',
        provider: 'greenhouse',
        company: 'TymeX',
        title: 'Backend Developer',
        location: 'Ho Chi Minh City',
        url: 'https://example.com/tier2',
      },
      {
        id: 'job-tier1',
        provider: 'greenhouse',
        company: 'Thoughtworks',
        title: 'Middle Software Engineer',
        location: 'Ho Chi Minh City',
        url: 'https://example.com/tier1',
      },
    ];

    const ranked = matchAndRankJobs(jobs, mockRoles, mockCompanies);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].job.company).toBe('Thoughtworks');
    expect(ranked[1].job.company).toBe('TymeX');
  });
});

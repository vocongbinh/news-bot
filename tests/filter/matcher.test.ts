import { describe, expect, it } from 'vitest';
import type { CompanyConfig, NormalizedJob, RoleConfig } from '../../src/fetchers/types.ts';
import { isLocationValid, matchAndRankJobs, matchJob } from '../../src/filter/matcher.ts';

const mockRoles: RoleConfig = {
  include: [
    { pattern: 'software\\s+engineer|developer', category: 'software-engineer' },
    { pattern: 'backend|node|python|java', category: 'backend' },
    { pattern: 'fullstack|full-stack', category: 'fullstack' },
    { pattern: 'ai\\s*(?:agent|engineer|ops)', category: 'ai-agent' },
  ],
  exclude: ['sales', 'civil', 'hr', 'recruiter', 'marketing'],
};

const mockCompanies: CompanyConfig[] = [
  { name: 'Thoughtworks', provider: 'greenhouse', token: 'thoughtworks', priority: 1 },
  { name: 'Grab', provider: 'smartrecruiters', companyId: 'Grab', priority: 1 },
  { name: 'TymeX', provider: 'greenhouse', token: 'tymex', priority: 2 },
];

describe('Job Matcher', () => {
  it('identifies and classifies valid tech roles', () => {
    const job: NormalizedJob = {
      id: 'job-1',
      provider: 'greenhouse',
      company: 'Thoughtworks',
      title: 'Senior Full-Stack Engineer (Node.js/React)',
      location: 'Ho Chi Minh City, Vietnam',
      url: 'https://example.com/1',
    };

    const match = matchJob(job, mockRoles, 1);
    expect(match).not.toBeNull();
    expect(match?.categories).toContain('fullstack');
    expect(match?.categories).toContain('backend');
    expect(match?.priority).toBeGreaterThan(100);
  });

  it('matches AI agent and AI engineering roles with bonus points', () => {
    const job: NormalizedJob = {
      id: 'job-ai',
      provider: 'workday',
      company: 'NAB',
      title: 'Senior AI Ops Engineer',
      location: 'Hanoi, Vietnam',
      url: 'https://example.com/ai',
    };

    const match = matchJob(job, mockRoles, 1);
    expect(match).not.toBeNull();
    expect(match?.categories).toContain('ai-agent');
    expect(match?.priority).toBeGreaterThan(120);
  });

  it('excludes non-engineering roles even if partial keywords match', () => {
    const job: NormalizedJob = {
      id: 'job-sales',
      provider: 'itviec',
      company: 'Company A',
      title: 'Sales Engineer for Enterprise Products',
      location: 'Vietnam',
      url: 'https://example.com/sales',
    };

    const match = matchJob(job, mockRoles);
    expect(match).toBeNull();
  });

  it('rejects roles with purely foreign locations', () => {
    const job: NormalizedJob = {
      id: 'job-foreign',
      provider: 'greenhouse',
      company: 'Company B',
      title: 'Backend Developer',
      location: 'Chicago, United States',
      url: 'https://example.com/foreign',
    };

    expect(isLocationValid(job.location)).toBe(false);
    expect(matchJob(job, mockRoles)).toBeNull();
  });

  it('accepts remote roles', () => {
    expect(isLocationValid('Remote - Vietnam')).toBe(true);
    expect(isLocationValid('APAC Remote')).toBe(true);
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
        title: 'Lead Software Engineer',
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

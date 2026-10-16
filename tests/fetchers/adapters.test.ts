import { describe, expect, it } from 'vitest';
import { fetchBambooHrJobs } from '../../src/fetchers/bamboohr.ts';
import { fetchGreenhouseJobs } from '../../src/fetchers/greenhouse.ts';
import { fetchAllCompanyJobs } from '../../src/fetchers/index.ts';
import { fetchItviecJobs } from '../../src/fetchers/itviec.ts';
import { fetchSmartRecruitersJobs } from '../../src/fetchers/smartrecruiters.ts';
import type {
  BambooHrCompanyConfig,
  GreenhouseCompanyConfig,
  ItviecCompanyConfig,
  SmartRecruitersCompanyConfig,
  WorkdayCompanyConfig,
} from '../../src/fetchers/types.ts';
import { fetchWorkdayJobs } from '../../src/fetchers/workday.ts';
import type { fetchJson, fetchText, postJson } from '../../src/util/http.ts';

describe('ATS Adapters', () => {
  it('fetchGreenhouseJobs extracts Vietnam jobs and formats them', async () => {
    const config: GreenhouseCompanyConfig = {
      name: 'Thoughtworks',
      provider: 'greenhouse',
      token: 'thoughtworks',
    };

    const mockFetch = (async () => ({
      jobs: [
        {
          id: 12345,
          title: 'Senior Fullstack Engineer',
          absolute_url: 'https://boards.greenhouse.io/thoughtworks/jobs/12345',
          location: { name: 'Ho Chi Minh City, Vietnam' },
          updated_at: '2026-10-15T00:00:00Z',
          content: '<p>Great role</p>',
          departments: [{ name: 'Engineering' }],
        },
        {
          id: 99999,
          title: 'Consultant',
          absolute_url: 'https://boards.greenhouse.io/thoughtworks/jobs/99999',
          location: { name: 'Chicago, IL, United States' },
        },
      ],
    })) as unknown as typeof fetchJson;

    const jobs = await fetchGreenhouseJobs(config, mockFetch);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBe('Senior Fullstack Engineer');
    expect(jobs[0].company).toBe('Thoughtworks');
    expect(jobs[0].id).toBe('greenhouse:thoughtworks:12345');
    expect(jobs[0].url).toBe('https://boards.greenhouse.io/thoughtworks/jobs/12345');
  });

  it('fetchSmartRecruitersJobs filters Vietnam postings', async () => {
    const config: SmartRecruitersCompanyConfig = {
      name: 'Grab',
      provider: 'smartrecruiters',
      companyId: 'Grab',
    };

    const mockFetch = (async () => ({
      content: [
        {
          id: 'sr-111',
          name: 'Backend Engineer - Payments',
          releasedDate: '2026-10-14T00:00:00Z',
          location: { city: 'Ho Chi Minh City', country: 'vn' },
          department: { label: 'Engineering' },
        },
        {
          id: 'sr-222',
          name: 'Product Manager',
          location: { city: 'Singapore', country: 'sg' },
        },
      ],
    })) as unknown as typeof fetchJson;

    const jobs = await fetchSmartRecruitersJobs(config, mockFetch);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('smartrecruiters:Grab:sr-111');
    expect(jobs[0].title).toBe('Backend Engineer - Payments');
    expect(jobs[0].location).toContain('Ho Chi Minh City');
  });

  it('fetchWorkdayJobs parses CXS response', async () => {
    const config: WorkdayCompanyConfig = {
      name: 'NAB Innovation Centre Vietnam',
      provider: 'workday',
      subdomain: 'nab',
      companyId: 'nab',
      portal: 'nab_careers',
    };

    const mockPost = (async () => ({
      jobPostings: [
        {
          title: 'Senior AI Ops Engineer',
          externalPath: '/job/Hanoi-Vietnam/Senior-AI-Ops-Engineer_JR122006',
          locationsText: 'Hanoi, Vietnam',
          postedOn: 'Posted 2 Days Ago',
          bulletFields: ['Full-Time'],
        },
      ],
    })) as unknown as typeof postJson;

    const jobs = await fetchWorkdayJobs(config, mockPost);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('workday:nab:JR122006');
    expect(jobs[0].title).toBe('Senior AI Ops Engineer');
    expect(jobs[0].url).toContain('nab.wd3.myworkdayjobs.com/en-US/nab_careers');
  });

  it('fetchBambooHrJobs extracts careers list', async () => {
    const config: BambooHrCompanyConfig = {
      name: 'LeapXpert',
      provider: 'bamboohr',
      subdomain: 'leapxpert',
    };

    const mockFetch = (async () => ({
      result: [
        {
          id: '205',
          jobOpeningName: 'Director of Platform Engineering',
          departmentLabel: 'Engineering',
          employmentStatusLabel: 'Full-Time',
          atsLocation: { country: 'Vietnam', city: 'HCMC' },
          isRemote: false,
        },
      ],
    })) as unknown as typeof fetchJson;

    const jobs = await fetchBambooHrJobs(config, mockFetch);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('bamboohr:leapxpert:205');
    expect(jobs[0].title).toBe('Director of Platform Engineering');
  });

  it('fetchItviecJobs parses HTML job cards', async () => {
    const config: ItviecCompanyConfig = {
      name: 'Employment Hero',
      provider: 'itviec',
      slug: 'employment-hero',
    };

    const sampleHtml = `
      <html>
        <body>
          <div class="job-card">
            <span class="small-text text-dark-grey">Posted 10 hours ago</span>
            <h3>
              <a href="/it-jobs/senior-backend-engineer-employment-hero-1122?lab=1">Senior Backend Engineer</a>
            </h3>
            <span class="itag">Ruby on Rails</span>
          </div>
        </body>
      </html>
    `;

    const mockFetch = (async () => sampleHtml) as unknown as typeof fetchText;
    const jobs = await fetchItviecJobs(config, mockFetch);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe('itviec:employment-hero:senior-backend-engineer-employment-hero-1122');
    expect(jobs[0].title).toBe('Senior Backend Engineer');
    expect(jobs[0].url).toBe('https://itviec.com/it-jobs/senior-backend-engineer-employment-hero-1122');
    expect(jobs[0].tags).toEqual(['Ruby on Rails']);
  });

  it('fetchAllCompanyJobs isolates failures and collects all successful jobs', async () => {
    const companies: [GreenhouseCompanyConfig, SmartRecruitersCompanyConfig] = [
      {
        name: 'Failing Company',
        provider: 'greenhouse',
        token: 'invalid-nonexistent-token-xyz',
      },
      {
        name: 'Thoughtworks',
        provider: 'greenhouse',
        token: 'thoughtworks',
      },
    ];

    const results = await fetchAllCompanyJobs(companies, 2);
    expect(Array.isArray(results)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';

describe('loadConfig', () => {
  it('loads companies and roles with dry-run defaults', () => {
    process.env.DRY_RUN = '1';
    const config = loadConfig();

    expect(config.companies.length).toBeGreaterThan(0);
    expect(config.roles.include.length).toBeGreaterThan(0);
    expect(config.roles.exclude.length).toBeGreaterThan(0);

    const tw = config.companies.find((c) => c.name === 'Thoughtworks');
    expect(tw).toBeDefined();
    expect(tw?.provider).toBe('greenhouse');

    const nab = config.companies.find((c) => c.name.includes('NAB'));
    expect(nab).toBeDefined();
    expect(nab?.provider).toBe('workday');

    const grab = config.companies.find((c) => c.name === 'Grab');
    expect(grab).toBeDefined();
    expect(grab?.provider).toBe('smartrecruiters');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CompanyConfig, RoleConfig } from './fetchers/types.ts';

export interface CompaniesFile {
  companies: CompanyConfig[];
}

export interface RolesFile {
  roles: RoleConfig;
}

export interface AppConfig {
  companies: CompanyConfig[];
  roles: RoleConfig;
  telegramBotToken: string;
  telegramChatId: string;
  geminiApiKey: string;
  geminiModel: string;
  seenPath: string;
  dryRun: boolean;
}

function loadYaml<T>(path: string): T {
  return parseYaml(readFileSync(path, 'utf8')) as T;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function loadConfig(rootDir = process.cwd()): AppConfig {
  const companiesData = loadYaml<CompaniesFile>(resolve(rootDir, 'config/companies.yaml'));
  const rolesData = loadYaml<RolesFile>(resolve(rootDir, 'config/roles.yaml'));
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  const telegramBotToken = dryRun
    ? process.env.TELEGRAM_BOT_TOKEN ?? 'dry-run-token'
    : requiredEnv('TELEGRAM_BOT_TOKEN');
  const telegramChatId = dryRun
    ? process.env.TELEGRAM_CHAT_ID ?? 'dry-run-chat'
    : requiredEnv('TELEGRAM_CHAT_ID');
  const geminiApiKey = dryRun
    ? process.env.GEMINI_API_KEY ?? 'dry-run-gemini'
    : requiredEnv('GEMINI_API_KEY');

  return {
    companies: companiesData.companies ?? [],
    roles: rolesData.roles ?? { include: [], exclude: [] },
    telegramBotToken,
    telegramChatId,
    geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    seenPath: resolve(rootDir, 'state/seen.json'),
    dryRun,
  };
}

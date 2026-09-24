import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface RssSourceConfig {
  id: string;
  url: string;
  weight: number;
  tags?: string[];
  enabled?: boolean;
}

export interface SourcesConfig {
  hn: {
    enabled: boolean;
    weight: number;
    windowHours: number;
    maxItems: number;
  };
  rss: RssSourceConfig[];
}

export interface TopicsConfig {
  topK: number;
  minScore: number;
  truncateChars: number;
  allowKeywords: string[];
  denyKeywords: string[];
  weights: {
    keywordHit: number;
    recencyMax: number;
    hnPointsDivisor: number;
    denyHit: number;
  };
}

export interface AppConfig {
  sources: SourcesConfig;
  topics: TopicsConfig;
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
  const sources = loadYaml<SourcesConfig>(resolve(rootDir, 'config/sources.yaml'));
  const topics = loadYaml<TopicsConfig>(resolve(rootDir, 'config/topics.yaml'));
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
    sources,
    topics,
    telegramBotToken,
    telegramChatId,
    geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
    seenPath: resolve(rootDir, 'state/seen.json'),
    dryRun,
  };
}

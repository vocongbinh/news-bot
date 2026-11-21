import { loadConfig } from './config.ts';
import { fetchAllCompanyJobs } from './fetchers/index.ts';
import type { JobSummary, NormalizedJob } from './fetchers/types.ts';
import { matchAndRankJobs } from './filter/matcher.ts';
import { loadSeen, markSeen, pruneSeen, saveSeen } from './state/seen.ts';
import { summarizeJob } from './summarize/gemini.ts';
import { buildJobKeyboard, formatJobCard, formatJobHeader } from './telegram/format.ts';
import { sendDigestMessages } from './telegram/send.ts';
import { formatDigestHeading, nowIso } from './util/time.ts';

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
      results[idx] = await worker(items[idx]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function normalizeJobKey(company: string, title: string): string {
  const normCompany = company.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${normCompany}::${normTitle}`;
}

function deduplicateCrossSource(
  jobs: NormalizedJob[],
  seenKeys: Set<string>,
): NormalizedJob[] {
  // Prefer direct ATS postings over LinkedIn aggregator duplicates
  const sorted = [...jobs].sort((a, b) => {
    const aAgg = a.provider === 'linkedin' ? 1 : 0;
    const bAgg = b.provider === 'linkedin' ? 1 : 0;
    return aAgg - bAgg;
  });

  const unique: NormalizedJob[] = [];
  const batchKeys = new Set<string>();
  for (const job of sorted) {
    const key = normalizeJobKey(job.company, job.title);
    if (seenKeys.has(key) || batchKeys.has(key)) {
      continue;
    }
    batchKeys.add(key);
    unique.push(job);
  }
  return unique;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const seen = loadSeen(config.seenPath);
  pruneSeen(seen, new Date(), 30);

  console.log(`[Ingest] Fetching jobs for ${config.companies.length} configured sources...`);
  const rawJobs = await fetchAllCompanyJobs(config.companies, 3);
  console.log(`[Ingest] Retrieved ${rawJobs.length} active jobs across all providers`);

  // Deduplicate against previously notified jobs (by ID and cross-source company+title)
  const seenCrossKeys = new Set(
    Object.values(seen.items).map((item) => normalizeJobKey(item.source, item.title)),
  );
  const unseenById = rawJobs.filter((job) => !seen.items[job.id]);
  const unseenJobs = deduplicateCrossSource(unseenById, seenCrossKeys);
  console.log(`[Dedupe] ${unseenJobs.length} new/unseen unique jobs to evaluate`);

  if (unseenJobs.length === 0) {
    saveSeen(config.seenPath, seen);
    console.log('[Pipeline] No new jobs to process.');
    return;
  }

  // Filter and rank matching target tech roles
  const matches = matchAndRankJobs(unseenJobs, config.roles, config.companies);
  console.log(`[Match] ${matches.length} jobs matched target Software & AI engineering criteria`);

  // Mark non-matching unseen jobs as skipped so they are not re-evaluated on every run
  const matchedIds = new Set(matches.map((m) => m.job.id));
  for (const job of unseenJobs) {
    if (!matchedIds.has(job.id)) {
      markSeen(seen, {
        id: job.id,
        url: job.url,
        title: job.title,
        source: job.company,
        status: 'skipped',
        at: nowIso(),
      });
    }
  }

  if (matches.length === 0) {
    saveSeen(config.seenPath, seen);
    console.log('[Pipeline] No target engineering matches found in unseen postings.');
    return;
  }

  // Cap at top 12 most relevant roles per digest
  const topMatches = matches.slice(0, 12);
  console.log(`[Summarize] Generating AI summaries for top ${topMatches.length} roles...`);

  const summaries = await mapLimit(topMatches, 3, async (match) => {
    return await summarizeJob({
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      match,
      dryRun: config.dryRun,
    });
  });

  const heading = formatDigestHeading();
  const header = formatJobHeader({
    when: heading.when,
    count: summaries.length,
  });

  let sentCount = 0;
  try {
    sentCount = await sendDigestMessages({
      botToken: config.telegramBotToken,
      chatId: config.telegramChatId,
      header,
      articles: summaries.map((summary) => ({
        text: formatJobCard(summary),
        replyMarkup: buildJobKeyboard(summary),
      })),
      dryRun: config.dryRun,
    });
  } catch (err) {
    const partial =
      typeof err === 'object' && err !== null && 'sentCount' in err
        ? Number(err.sentCount)
        : 0;
    sentCount = Number.isFinite(partial) ? partial : 0;
    for (let i = 0; i < sentCount; i++) {
      const summary = summaries[i]!;
      markSeen(seen, {
        id: summary.match.job.id,
        url: summary.match.job.url,
        title: summary.match.job.title,
        source: summary.match.job.company,
        status: 'sent',
        at: nowIso(),
      });
    }
    saveSeen(config.seenPath, seen);
    throw err;
  }

  for (const summary of summaries.slice(0, sentCount)) {
    markSeen(seen, {
      id: summary.match.job.id,
      url: summary.match.job.url,
      title: summary.match.job.title,
      source: summary.match.job.company,
      status: 'sent',
      at: nowIso(),
    });
  }

  saveSeen(config.seenPath, seen);
  console.log(`[Alert] Successfully dispatched ${sentCount} job alerts to Telegram!`);
}

main().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exitCode = 1;
});

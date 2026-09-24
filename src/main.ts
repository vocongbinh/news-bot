import { loadConfig } from './config.ts';
import { extractArticle } from './extract/readability.ts';
import { fetchHnTop } from './fetchers/hn.ts';
import { fetchAllRss } from './fetchers/rss.ts';
import type { ArticleSummary, RawItem } from './fetchers/types.ts';
import { rankItems } from './filter/rank.ts';
import { loadSeen, markSeen, pruneSeen, saveSeen } from './state/seen.ts';
import { summarizeArticle } from './summarize/gemini.ts';
import { buildArticleKeyboard, formatArticle, formatHeader } from './telegram/format.ts';
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

async function main(): Promise<void> {
  const config = loadConfig();
  const seen = loadSeen(config.seenPath);
  pruneSeen(seen, new Date(), 30);

  const raw: RawItem[] = [];
  raw.push(...(await fetchAllRss(config.sources.rss)));
  if (config.sources.hn.enabled) {
    try {
      const hnItems = await fetchHnTop({
        weightWindowHours: config.sources.hn.windowHours,
        maxItems: config.sources.hn.maxItems,
      });
      raw.push(...hnItems);
    } catch (err) {
      console.warn('HN fetch failed:', err);
    }
  }

  const sourceWeights: Record<string, number> = { hn: config.sources.hn.weight };
  for (const src of config.sources.rss) {
    sourceWeights[src.id] = src.weight;
    sourceWeights[`rss:${src.id}`] = src.weight;
  }

  const ranked = rankItems(raw, seen, config.topics, sourceWeights);
  console.log(`Fetched ${raw.length} items; selected ${ranked.length}`);
  if (ranked.length === 0) {
    saveSeen(config.seenPath, seen);
    return;
  }

  const extracted = await mapLimit(ranked, 3, async (item) => ({
    item,
    extract: await extractArticle(item, config.topics.truncateChars),
  }));

  const sendable: ArticleSummary[] = [];
  for (const row of extracted) {
    if (!row.extract.ok) {
      const prev = seen.items[row.item.id];
      const status = prev?.status === 'extract_failed' ? 'skipped' : 'extract_failed';
      markSeen(seen, {
        id: row.item.id,
        url: row.item.url,
        title: row.item.title,
        source: row.item.source,
        status,
      });
      continue;
    }

    try {
      const summary = await summarizeArticle({
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        item: row.item,
        text: row.extract.text,
        dryRun: config.dryRun,
      });
      if (summary.skip) {
        markSeen(seen, {
          id: row.item.id,
          url: row.item.url,
          title: row.item.title,
          source: row.item.source,
          status: 'skipped',
        });
        continue;
      }
      sendable.push(summary);
    } catch (err) {
      console.warn(`summarize failed for ${row.item.id}:`, err);
    }
  }

  if (sendable.length === 0) {
    saveSeen(config.seenPath, seen);
    return;
  }

  const heading = formatDigestHeading();
  const header = formatHeader({
    emoji: heading.emoji,
    label: heading.label,
    when: heading.when,
    count: sendable.length,
  });

  let sentCount = 0;
  try {
    sentCount = await sendDigestMessages({
      botToken: config.telegramBotToken,
      chatId: config.telegramChatId,
      header,
      articles: sendable.map((summary) => ({
        text: formatArticle(summary),
        replyMarkup: buildArticleKeyboard(summary),
      })),
      dryRun: config.dryRun,
    });
  } catch (err) {
    const partial =
      typeof err === 'object' && err && 'sentCount' in err
        ? Number((err as { sentCount?: number }).sentCount ?? 0)
        : 0;
    sentCount = Number.isFinite(partial) ? partial : 0;
    for (let i = 0; i < sentCount; i++) {
      const summary = sendable[i]!;
      markSeen(seen, {
        id: summary.item.id,
        url: summary.item.url,
        title: summary.item.title,
        source: summary.item.source,
        status: 'sent',
        at: nowIso(),
      });
    }
    saveSeen(config.seenPath, seen);
    throw err;
  }

  for (const summary of sendable.slice(0, sentCount)) {
    markSeen(seen, {
      id: summary.item.id,
      url: summary.item.url,
      title: summary.item.title,
      source: summary.item.source,
      status: 'sent',
      at: nowIso(),
    });
  }
  saveSeen(config.seenPath, seen);
  console.log(`Digest sent: ${sentCount} articles`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

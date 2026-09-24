const DEFAULT_UA =
  'news-bot/0.1 (+https://github.com/binhvc/news-bot; personal digest)';

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; accept?: string } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_UA,
        accept: opts.accept ?? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const text = await fetchText(url, {
    timeoutMs,
    accept: 'application/json',
  });
  return JSON.parse(text) as T;
}

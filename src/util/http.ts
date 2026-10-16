if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; accept?: string; headers?: Record<string, string> } = {},
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
        ...opts.headers,
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

export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const text = await fetchText(url, {
    timeoutMs: opts.timeoutMs ?? 12_000,
    accept: 'application/json',
    headers: opts.headers,
  });
  return JSON.parse(text) as T;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'user-agent': DEFAULT_UA,
        'content-type': 'application/json',
        accept: 'application/json',
        ...opts.headers,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const text = await res.text();
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

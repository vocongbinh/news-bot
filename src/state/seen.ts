import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SeenStatus, SeenStore } from '../fetchers/types.ts';
import { nowIso } from '../util/time.ts';

export function loadSeen(path: string): SeenStore {
  if (!existsSync(path)) {
    return { version: 1, updatedAt: nowIso(), items: {} };
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as SeenStore;
  return {
    version: 1,
    updatedAt: raw.updatedAt ?? nowIso(),
    items: raw.items ?? {},
  };
}

export function saveSeen(path: string, store: SeenStore): void {
  store.updatedAt = nowIso();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

export function shouldConsider(store: SeenStore, id: string): boolean {
  const existing = store.items[id];
  if (!existing) return true;
  return existing.status === 'extract_failed';
}

export function markSeen(
  store: SeenStore,
  input: {
    id: string;
    url: string;
    title: string;
    source: string;
    status: SeenStatus;
    at?: string;
  },
): void {
  const at = input.at ?? nowIso();
  store.items[input.id] = {
    url: input.url,
    title: input.title,
    source: input.source,
    seenAt: at,
    digestAt: input.status === 'sent' ? at : store.items[input.id]?.digestAt,
    status: input.status,
  };
}

export function pruneSeen(store: SeenStore, now = new Date(), retainDays = 30): void {
  const cutoff = now.getTime() - retainDays * 24 * 60 * 60 * 1000;
  for (const [id, item] of Object.entries(store.items)) {
    const ts = Date.parse(item.seenAt);
    if (Number.isFinite(ts) && ts < cutoff) {
      delete store.items[id];
    }
  }
}

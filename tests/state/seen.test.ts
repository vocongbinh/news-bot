import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadSeen,
  saveSeen,
  pruneSeen,
  shouldConsider,
  markSeen,
} from '../../src/state/seen.ts';
import type { SeenStore } from '../../src/fetchers/types.ts';

function emptyStore(): SeenStore {
  return { version: 1, updatedAt: '2026-09-01T00:00:00+07:00', items: {} };
}

describe('seen store', () => {
  it('loads empty store when file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seen-'));
    const store = loadSeen(join(dir, 'missing.json'));
    expect(store.items).toEqual({});
    expect(store.version).toBe(1);
  });

  it('round-trips save/load', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seen-'));
    const path = join(dir, 'seen.json');
    const store = emptyStore();
    markSeen(store, {
      id: 'hn:1',
      url: 'https://example.com',
      title: 'Hello',
      source: 'hn',
      status: 'sent',
      at: '2026-09-24T07:00:00+07:00',
    });
    saveSeen(path, store);
    const loaded = loadSeen(path);
    expect(loaded.items['hn:1']?.status).toBe('sent');
  });

  it('allows retry only for extract_failed', () => {
    const store = emptyStore();
    store.items['a'] = {
      url: 'u',
      title: 't',
      source: 'hn',
      seenAt: '2026-09-01T00:00:00+07:00',
      status: 'sent',
    };
    store.items['b'] = {
      url: 'u2',
      title: 't2',
      source: 'hn',
      seenAt: '2026-09-01T00:00:00+07:00',
      status: 'extract_failed',
    };
    expect(shouldConsider(store, 'a')).toBe(false);
    expect(shouldConsider(store, 'b')).toBe(true);
    expect(shouldConsider(store, 'c')).toBe(true);
  });

  it('prunes entries older than 30 days', () => {
    const store = emptyStore();
    store.items['old'] = {
      url: 'u',
      title: 't',
      source: 'hn',
      seenAt: '2026-01-01T00:00:00+07:00',
      status: 'sent',
    };
    store.items['new'] = {
      url: 'u2',
      title: 't2',
      source: 'hn',
      seenAt: '2026-09-20T00:00:00+07:00',
      status: 'sent',
    };
    pruneSeen(store, new Date('2026-09-24T00:00:00+07:00'), 30);
    expect(store.items.old).toBeUndefined();
    expect(store.items.new).toBeDefined();
  });
});

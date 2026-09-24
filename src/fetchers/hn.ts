import { fetchJson } from '../util/http.ts';
import type { RawItem } from './types.ts';

interface HnHit {
  objectID: string;
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  story_text?: string;
}

interface HnSearchResponse {
  hits: HnHit[];
}

export async function fetchHnTop(opts: {
  weightWindowHours: number;
  maxItems: number;
}): Promise<RawItem[]> {
  const url =
    'https://hn.algolia.com/api/v1/search' +
    '?tags=story' +
    '&numericFilters=points>20' +
    `&hitsPerPage=${opts.maxItems}`;
  const data = await fetchJson<HnSearchResponse>(url);
  const cutoff = Date.now() - opts.weightWindowHours * 3_600_000;

  return data.hits
    .map((hit) => {
      const link = hit.url?.trim();
      if (!link) return null;
      const createdMs = hit.created_at ? Date.parse(hit.created_at) : NaN;
      if (Number.isFinite(createdMs) && createdMs < cutoff) return null;
      const item: RawItem = {
        id: `hn:${hit.objectID}`,
        url: link,
        title: hit.title?.trim() || link,
        source: 'hn',
        publishedAt: hit.created_at,
        points: hit.points,
        snippet: hit.story_text?.slice(0, 500),
        discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      };
      return item;
    })
    .filter((x): x is RawItem => x !== null);
}

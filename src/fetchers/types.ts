export type SeenStatus = 'sent' | 'skipped' | 'extract_failed';

export interface RawItem {
  id: string;
  url: string;
  title: string;
  source: string;
  publishedAt?: string;
  points?: number;
  snippet?: string;
  discussionUrl?: string;
  rawContent?: string;
}

export interface RankedItem extends RawItem {
  score: number;
}

export interface ArticleSummary {
  item: RankedItem;
  skip: boolean;
  topicTags: string[];
  readingMinutes: number;
  bullets: string[];
  keyInsight: string;
  hook?: string;
}

export interface SeenItem {
  url: string;
  title: string;
  source: string;
  seenAt: string;
  digestAt?: string;
  status: SeenStatus;
}

export interface SeenStore {
  version: 1;
  updatedAt: string;
  items: Record<string, SeenItem>;
}

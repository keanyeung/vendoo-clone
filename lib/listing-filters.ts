import type { ItemStatus } from "@prisma/client";

import { daysListed } from "./listing-sort";
import {
  livePlatforms,
  type PostingPlatform,
  type PostingState,
} from "./postings";

export type AttentionFilterKey =
  | "aging"
  | "stale-drafts"
  | "missing-fees"
  | "listed-unposted";

export type ListingFilterItem = {
  status: ItemStatus;
  createdAt: string;
  soldDate: string | null;
  platformFees: number | null;
  postings: readonly PostingState[];
};

export function isAgingListing(
  item: ListingFilterItem,
  nowMs: number,
): boolean {
  return item.status === "LISTED" && daysListed(item, nowMs) > 45;
}

export function isStaleDraft(
  item: ListingFilterItem,
  nowMs: number,
): boolean {
  return item.status === "DRAFT" && daysListed(item, nowMs) > 7;
}

export function isMissingFeesSale(
  item: ListingFilterItem,
  nowMs: number,
): boolean {
  void nowMs;
  return item.status === "SOLD" && item.platformFees === null;
}

export function isListedButNotPosted(
  item: ListingFilterItem,
  nowMs: number,
): boolean {
  void nowMs;
  return item.status === "LISTED" && livePlatforms(item.postings).length === 0;
}

export function isMissingPostingPlatform(
  item: Pick<ListingFilterItem, "postings">,
  platform: PostingPlatform,
): boolean {
  return !livePlatforms(item.postings).includes(platform);
}

export const ATTENTION_FILTERS = [
  {
    key: "aging",
    label: "Aging (45d+)",
    matches: isAgingListing,
  },
  {
    key: "stale-drafts",
    label: "Stale drafts (7d+)",
    matches: isStaleDraft,
  },
  {
    key: "missing-fees",
    label: "Missing fees",
    matches: isMissingFeesSale,
  },
  {
    key: "listed-unposted",
    label: "Listed but not posted",
    matches: isListedButNotPosted,
  },
] satisfies ReadonlyArray<{
  key: AttentionFilterKey;
  label: string;
  matches: (item: ListingFilterItem, nowMs: number) => boolean;
}>;

export function isAttentionFilterKey(
  value: string,
): value is AttentionFilterKey {
  return ATTENTION_FILTERS.some((filter) => filter.key === value);
}

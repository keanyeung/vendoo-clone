import type { Platform } from "@prisma/client";

export const POSTING_PLATFORMS = [
  "FB_MARKETPLACE",
  "DEPOP",
  "EBAY",
] as const satisfies readonly Platform[];

export type PostingPlatform = (typeof POSTING_PLATFORMS)[number];

const POSTING_PLATFORM_LABELS: Record<PostingPlatform, string> = {
  FB_MARKETPLACE: "Facebook",
  DEPOP: "Depop",
  EBAY: "eBay",
};

export type PostingState = {
  platform: Platform;
  removedAt: string | Date | null;
};

export function isPostingPlatform(value: string): value is PostingPlatform {
  return POSTING_PLATFORMS.some((platform) => platform === value);
}

export function livePlatforms(
  postings: readonly PostingState[],
): Platform[] {
  const live = new Set(
    postings
      .filter((posting): boolean => posting.removedAt === null)
      .map((posting): Platform => posting.platform),
  );
  return POSTING_PLATFORMS.filter((platform): boolean => live.has(platform));
}

export function missingPlatforms(
  postings: readonly PostingState[],
): Platform[] {
  const live = new Set(livePlatforms(postings));
  return POSTING_PLATFORMS.filter((platform): boolean => !live.has(platform));
}

export function postingSummary(postings: readonly PostingState[]): string {
  return `${livePlatforms(postings).length} of ${POSTING_PLATFORMS.length} marketplaces`;
}

export function postingAccessibleLabel(
  postings: readonly PostingState[],
): string {
  const labels = livePlatforms(postings).map(
    (platform) => POSTING_PLATFORM_LABELS[platform],
  );
  if (labels.length === 0) return "Not posted to any marketplace";
  if (labels.length === 1) return `Posted to ${labels[0]}`;
  if (labels.length === 2) return `Posted to ${labels[0]} and ${labels[1]}`;
  return `Posted to ${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

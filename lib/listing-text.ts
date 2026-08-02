import type { ItemDto } from "@/lib/item-dto";

export type ListingPlatform = "FB_MARKETPLACE" | "DEPOP" | "EBAY";

// Your fixed pickup/payment line, appended to every Facebook listing.
export const FB_PICKUP_DETAILS =
  "E-transfer or cash accepted, pickup in North Haven or meetups in NW Calgary";

const CONDITION_PHRASES: Record<string, string> = {
  new_with_tags: "New with tags",
  excellent: "Excellent condition",
  good: "Good condition",
  fair: "Fair condition",
  poor: "Poor condition",
};

// Whether a condition tier is presented as flawless. Everything with real wear
// (good/fair/poor) is disclosed as having minor flaws for buyer honesty.
const NO_FLAW_CONDITIONS = new Set<string>(["new_with_tags", "excellent"]);

export const PLATFORM_LABELS = {
  FB_MARKETPLACE: "Facebook",
  DEPOP: "Depop",
  EBAY: "eBay",
} satisfies Record<ListingPlatform, string>;

export const LISTING_PLATFORMS = [
  "FB_MARKETPLACE",
  "DEPOP",
  "EBAY",
] as const satisfies readonly ListingPlatform[];

export const TITLE_LIMITS = {
  FB_MARKETPLACE: 100,
  DEPOP: 65,
  EBAY: 80,
} satisfies Record<ListingPlatform, number>;

export const EBAY_TITLE_MAX_LENGTH = TITLE_LIMITS.EBAY;

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }

  const limitedTitle = title.slice(0, Math.max(0, maxLength));
  const lastWhitespaceIndex = limitedTitle.search(/\s+\S*$/);
  const wordSafeTitle =
    lastWhitespaceIndex > 0
      ? limitedTitle.slice(0, lastWhitespaceIndex)
      : limitedTitle;

  return wordSafeTitle.replace(/[\s\p{P}\p{S}]+$/gu, "").slice(0, maxLength);
}

function hasValue(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

// The condition line, e.g. "Good condition, minor flaws". Null when the item's
// condition is missing or unrecognized (then the line is skipped).
function conditionLine(item: ItemDto): string | null {
  const phrase = CONDITION_PHRASES[item.condition ?? ""];
  if (phrase === undefined) return null;
  const flaws = NO_FLAW_CONDITIONS.has(item.condition ?? "")
    ? "no flaws"
    : "minor flaws";
  return `${phrase}, ${flaws}`;
}

// Depop-style hashtags built from the item's keywords: lowercased, stripped to
// alphanumerics, de-duplicated, and capped at five.
function depopHashtags(item: ItemDto): string {
  return [
    ...new Set(
      item.keywords
        .map((keyword: string) => keyword.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter((keyword: string) => keyword.length > 0),
    ),
  ]
    .slice(0, 5)
    .map((keyword: string) => `#${keyword}`)
    .join(" ");
}

export function getListingBody(
  item: Pick<ItemDto, "description" | "summary">,
): string {
  if (hasValue(item.description)) return item.description.trim();
  return hasValue(item.summary) ? item.summary.trim() : "";
}

// Every platform shares one listing body, then a details block (condition +
// flaws, then size when known), plus optional platform extras. The title is
// intentionally excluded because it is copied on its own; price is excluded
// because each platform has its own price field.
function formatMarketplace(
  item: ItemDto,
  options: { pickup?: boolean; hashtags?: boolean } = {},
): string {
  const listingBody = getListingBody(item);

  const detailLines: string[] = [];
  const condition = conditionLine(item);
  if (condition !== null) detailLines.push(condition);
  if (hasValue(item.size)) detailLines.push(`Size: ${item.size}`);
  if (options.pickup) detailLines.push(FB_PICKUP_DETAILS);

  const blocks: string[] = [listingBody, detailLines.join("\n")];
  if (options.hashtags) {
    const hashtags = depopHashtags(item);
    if (hashtags.length > 0) blocks.push(hashtags);
  }

  return blocks
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatListingText(
  item: ItemDto,
  platform: ListingPlatform,
): string {
  switch (platform) {
    case "FB_MARKETPLACE":
      return formatMarketplace(item, { pickup: true });
    case "DEPOP":
      return formatMarketplace(item, { hashtags: true });
    case "EBAY":
      return formatMarketplace(item);
  }
}

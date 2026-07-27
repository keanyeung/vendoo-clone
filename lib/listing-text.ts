import type { ItemDto } from "@/lib/item-dto";

export type ListingPlatform = "FB_MARKETPLACE" | "DEPOP" | "EBAY";

export const PLATFORM_LABELS = {
  FB_MARKETPLACE: "Facebook Marketplace",
  DEPOP: "Depop",
  EBAY: "eBay",
} satisfies Record<ListingPlatform, string>;

export const LISTING_PLATFORMS = [
  "FB_MARKETPLACE",
  "DEPOP",
  "EBAY",
] as const satisfies readonly ListingPlatform[];

export const EBAY_TITLE_MAX_LENGTH = 80;

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

export function formatListingText(
  item: ItemDto,
  platform: ListingPlatform,
): string {
  const title =
    platform === "EBAY"
      ? truncateTitle(item.title, EBAY_TITLE_MAX_LENGTH)
      : item.title;
  const sections: string[] = [title];
  const bodyParagraphs = [item.description];

  if (hasValue(item.conditionNotes)) {
    bodyParagraphs.push(item.conditionNotes);
  }

  sections.push(bodyParagraphs.join("\n\n"));

  const details: string[] = [];
  if (hasValue(item.brand)) details.push(`Brand: ${item.brand}`);
  if (hasValue(item.size)) details.push(`Size: ${item.size}`);
  if (hasValue(item.color)) details.push(`Color: ${item.color}`);
  if (hasValue(item.condition)) {
    details.push(`Condition: ${item.condition.replaceAll("_", " ")}`);
  }

  if (details.length > 0) {
    sections.push(["Details:", ...details].join("\n"));
  }

  if (platform === "DEPOP") {
    const hashtags = [
      ...new Set(
        item.keywords
          .map((keyword: string) =>
            keyword.toLowerCase().replace(/[^a-z0-9]/g, ""),
          )
          .filter((keyword: string) => keyword.length > 0),
      ),
    ]
      .slice(0, 5)
      .map((keyword: string) => `#${keyword}`)
      .join(" ");

    if (hashtags.length > 0) {
      sections.push(hashtags);
    }
  }

  // Price is excluded because every platform has its own price field.
  return sections.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

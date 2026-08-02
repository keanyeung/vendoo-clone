import { describe, expect, it } from "vitest";

import type { ItemDto } from "./item-dto";
import {
  FB_PICKUP_DETAILS,
  formatListingText,
  LISTING_PLATFORMS,
  type ListingPlatform,
} from "./listing-text";

function makeItem(overrides: Partial<ItemDto> = {}): ItemDto {
  return {
    id: "item-1",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    photos: [],
    title: "Vintage denim jacket",
    summary: "Fallback AI summary.",
    description: "Authoritative marketplace body.",
    brand: "Levi's",
    category: "Jackets",
    size: "M",
    color: "Blue",
    condition: "good",
    conditionNotes: null,
    suggestedPrice: 80,
    priceLow: 65,
    priceHigh: 95,
    priceReasoning: null,
    listPrice: 80,
    purchasePrice: 20,
    keywords: ["denim", "vintage"],
    aiConfidence: "high",
    purchaseDate: null,
    notes: null,
    status: "LISTED",
    soldPrice: null,
    soldPlatform: null,
    soldDate: null,
    platformFees: null,
    ...overrides,
  };
}

describe("formatListingText", () => {
  it.each(LISTING_PLATFORMS)(
    "uses description as the $platform listing body",
    (platform: ListingPlatform) => {
      const text = formatListingText(makeItem(), platform);

      expect(text).toMatch(/^Authoritative marketplace body\./);
      expect(text).not.toContain("Fallback AI summary.");
    },
  );

  it.each(LISTING_PLATFORMS)(
    "falls back to summary for $platform when description is blank",
    (platform: ListingPlatform) => {
      const text = formatListingText(
        makeItem({ description: "  \n ", summary: "  AI fallback body.  " }),
        platform,
      );

      expect(text).toMatch(/^AI fallback body\./);
    },
  );

  it("keeps the Facebook pickup line", () => {
    const text = formatListingText(makeItem(), "FB_MARKETPLACE");

    expect(text).toContain(FB_PICKUP_DETAILS);
  });

  it("caps Depop hashtags at five", () => {
    const text = formatListingText(
      makeItem({
        keywords: [
          "Denim",
          "Vintage Style",
          "Jacket",
          "Blue",
          "Levis",
          "Streetwear",
          "Outerwear",
        ],
      }),
      "DEPOP",
    );

    expect(text.match(/#[a-z0-9]+/g)).toEqual([
      "#denim",
      "#vintagestyle",
      "#jacket",
      "#blue",
      "#levis",
    ]);
  });
});

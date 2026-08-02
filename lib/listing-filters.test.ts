import { describe, expect, it } from "vitest";

import {
  ATTENTION_FILTERS,
  isAgingListing,
  isMissingFeesSale,
  isStaleDraft,
  type ListingFilterItem,
} from "./listing-filters";

const DAY_MS = 86_400_000;
const NOW_MS = Date.parse("2026-08-02T12:00:00.000Z");

function makeItem(
  overrides: Partial<ListingFilterItem> = {},
): ListingFilterItem {
  return {
    status: "LISTED",
    createdAt: new Date(NOW_MS).toISOString(),
    soldDate: null,
    platformFees: null,
    ...overrides,
  };
}

function createdDaysAgo(days: number): string {
  return new Date(NOW_MS - days * DAY_MS).toISOString();
}

describe("listing attention predicates", () => {
  it("marks drafts stale only after seven full days", () => {
    expect(
      isStaleDraft(
        makeItem({ status: "DRAFT", createdAt: createdDaysAgo(7) }),
        NOW_MS,
      ),
    ).toBe(false);
    expect(
      isStaleDraft(
        makeItem({ status: "DRAFT", createdAt: createdDaysAgo(8) }),
        NOW_MS,
      ),
    ).toBe(true);
    expect(
      isStaleDraft(
        makeItem({ status: "LISTED", createdAt: createdDaysAgo(8) }),
        NOW_MS,
      ),
    ).toBe(false);
  });

  it("marks listings aging only after 45 full days", () => {
    expect(
      isAgingListing(
        makeItem({ status: "LISTED", createdAt: createdDaysAgo(45) }),
        NOW_MS,
      ),
    ).toBe(false);
    expect(
      isAgingListing(
        makeItem({ status: "LISTED", createdAt: createdDaysAgo(46) }),
        NOW_MS,
      ),
    ).toBe(true);
    expect(
      isAgingListing(
        makeItem({ status: "DRAFT", createdAt: createdDaysAgo(46) }),
        NOW_MS,
      ),
    ).toBe(false);
  });

  it("marks sold items missing fees only when fees are null", () => {
    expect(
      isMissingFeesSale(
        makeItem({ status: "SOLD", platformFees: null }),
        NOW_MS,
      ),
    ).toBe(true);
    expect(
      isMissingFeesSale(
        makeItem({ status: "SOLD", platformFees: 0 }),
        NOW_MS,
      ),
    ).toBe(false);
    expect(
      isMissingFeesSale(
        makeItem({ status: "SOLD", platformFees: 12.5 }),
        NOW_MS,
      ),
    ).toBe(false);
    expect(
      isMissingFeesSale(
        makeItem({ status: "LISTED", platformFees: null }),
        NOW_MS,
      ),
    ).toBe(false);
  });

  it("registers every supported attention filter once", () => {
    expect(ATTENTION_FILTERS.map((filter) => filter.key)).toEqual([
      "aging",
      "stale-drafts",
      "missing-fees",
    ]);
  });
});

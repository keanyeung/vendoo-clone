import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  parseSort,
  serializeSort,
  sortItems,
  SORT_OPTIONS,
} from "./listing-sort";

describe("listing sort tokens", () => {
  it("round-trips every select option", () => {
    for (const option of SORT_OPTIONS) {
      expect(parseSort(serializeSort(option.token))).toEqual(option.token);
    }
  });

  it("parses legacy aliases for old bookmarks", () => {
    expect(parseSort("newest")).toEqual({ field: "added", dir: "desc" });
    expect(parseSort("oldest")).toEqual({ field: "added", dir: "asc" });
    expect(parseSort("price-high")).toEqual({ field: "price", dir: "desc" });
    expect(parseSort("price-low")).toEqual({ field: "price", dir: "asc" });
  });

  it("falls back to the default for an unknown token", () => {
    expect(parseSort("unknown-desc")).toEqual(DEFAULT_SORT);
  });

  it("sorts by live channel count without counting removed postings", () => {
    const base = {
      createdAt: "2026-08-01T00:00:00.000Z",
      listPrice: 20,
      soldPrice: null,
      soldDate: null,
      status: "LISTED" as const,
      title: "Listing",
    };
    const items = [
      {
        ...base,
        id: "removed",
        postings: [
          {
            platform: "EBAY" as const,
            removedAt: "2026-08-02T00:00:00.000Z",
          },
        ],
      },
      {
        ...base,
        id: "two-live",
        postings: [
          { platform: "DEPOP" as const, removedAt: null },
          { platform: "EBAY" as const, removedAt: null },
        ],
      },
      {
        ...base,
        id: "one-live",
        postings: [{ platform: "FB_MARKETPLACE" as const, removedAt: null }],
      },
    ];

    expect(
      sortItems(items, { field: "channels", dir: "desc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["two-live", "one-live", "removed"]);
  });
});

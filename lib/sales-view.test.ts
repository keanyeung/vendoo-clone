import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRANULARITY,
  summarize,
  type SalesRange,
} from "./analytics";
import type { ItemDto } from "./item-dto";
import { buildSalesView } from "./sales-view";
import { sortSoldItems } from "./sold-items-sort";

function makeItem(overrides: Partial<ItemDto> = {}): ItemDto {
  return {
    id: "item-1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    photos: [],
    title: "Test item",
    summary: null,
    description: "Fixture",
    brand: null,
    category: null,
    size: null,
    color: null,
    condition: null,
    conditionNotes: null,
    suggestedPrice: null,
    priceLow: null,
    priceHigh: null,
    priceReasoning: null,
    listPrice: 100,
    purchasePrice: 40,
    keywords: [],
    aiConfidence: null,
    purchaseDate: null,
    notes: null,
    status: "SOLD",
    soldPrice: 100,
    soldPlatform: "EBAY",
    soldDate: "2026-07-15T00:00:00.000Z",
    platformFees: 10,
    shippingCost: null,
    postings: [],
    ...overrides,
  };
}

const NOW = new Date("2026-07-31T12:00:00.000Z");

describe("buildSalesView", () => {
  it("splits current and comparison windows without leaking comparison sales", () => {
    const current = makeItem({
      id: "current",
      soldDate: "2026-07-20T10:00:00.000Z",
      soldPrice: 100,
      purchasePrice: 40,
      platformFees: 10,
      soldPlatform: "EBAY",
    });
    const comparison = makeItem({
      id: "comparison",
      soldDate: "2026-06-15T10:00:00.000Z",
      soldPrice: 80,
      purchasePrice: 20,
      platformFees: 5,
      soldPlatform: "DEPOP",
    });

    const view = buildSalesView([comparison, current], "month", NOW, null);

    expect(view.sales.map((sale) => sale.id)).toEqual(["current"]);
    expect(view.summary).toMatchObject({
      revenue: 100,
      cost: 40,
      fees: 10,
      shipping: 0,
      profit: 50,
      count: 1,
    });
    expect(view.previousSummary).toMatchObject({
      revenue: 80,
      cost: 20,
      fees: 5,
      shipping: 0,
      profit: 55,
      count: 1,
    });
    expect(view.platforms).toEqual([
      { platform: "EBAY", profit: 50, sharePct: 100 },
    ]);
  });

  it("serializes the exact current and equal-length previous month bounds", () => {
    const view = buildSalesView([], "month", NOW, null);

    expect(view.bounds).toEqual({
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    });
    expect(view.previous).toEqual({
      start: "2026-05-31T00:00:00.000Z",
      end: "2026-07-01T00:00:00.000Z",
    });
  });

  it.each<[SalesRange]>([["week"], ["month"], ["year"], ["all"]])(
    "uses the configured default granularity for %s",
    (range) => {
      expect(buildSalesView([], range, NOW, null).defaultGranularity).toBe(
        DEFAULT_GRANULARITY[range],
      );
    },
  );

  it("serializes the earliest sale and preserves a missing earliest sale as null", () => {
    const earliest = new Date("2025-08-03T17:45:00.000Z");

    expect(buildSalesView([], "month", NOW, earliest).earliestSoldAt).toBe(
      "2025-08-03T17:45:00.000Z",
    );
    expect(buildSalesView([], "month", NOW, null).earliestSoldAt).toBeNull();
  });

  it("starts all time at the earliest sale's UTC midnight and includes every sale", () => {
    const earliest = new Date("2025-08-03T17:45:00.000Z");
    const items = [
      makeItem({ id: "earliest", soldDate: "2025-08-03T17:45:00.000Z" }),
      makeItem({ id: "middle", soldDate: "2026-01-10T00:00:00.000Z" }),
      makeItem({ id: "latest", soldDate: "2026-07-31T23:59:59.999Z" }),
    ];

    const view = buildSalesView(items, "all", NOW, earliest);

    expect(view.bounds).toEqual({
      start: "2025-08-03T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    });
    expect(view.sales.map((sale) => sale.id)).toEqual([
      "latest",
      "middle",
      "earliest",
    ]);
  });

  it("returns JSON-safe empty collections and zeroed summaries", () => {
    const view = buildSalesView([], "month", NOW, null);
    const zeroSummary = {
      revenue: 0,
      cost: 0,
      fees: 0,
      shipping: 0,
      profit: 0,
      count: 0,
      avgProfit: null,
      avgDaysToSell: null,
      marginPct: null,
      roiPct: null,
    };

    expect(view.sales).toEqual([]);
    expect(view.platforms).toEqual([]);
    expect(view.summary).toEqual(zeroSummary);
    expect(view.previousSummary).toEqual(zeroSummary);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);

    const numericValues: number[] = [];
    JSON.stringify(view, (_key, value: unknown) => {
      if (typeof value === "number") numericValues.push(value);
      return value;
    });
    expect(numericValues.every((value) => !Number.isNaN(value))).toBe(true);
  });

  it("ignores rows outside both windows", () => {
    const view = buildSalesView(
      [
        makeItem({ id: "too-old", soldDate: "2026-05-30T23:59:59.999Z" }),
        makeItem({ id: "too-new", soldDate: "2026-08-01T00:00:00.000Z" }),
      ],
      "month",
      NOW,
      null,
    );

    expect(view.sales).toEqual([]);
    expect(view.summary.count).toBe(0);
    expect(view.previousSummary.count).toBe(0);
    expect(view.platforms).toEqual([]);
  });

  it("excludes non-sold rows and sold rows without a sold date", () => {
    const view = buildSalesView(
      [
        makeItem({ id: "listed", status: "LISTED" }),
        makeItem({ id: "missing-date", soldDate: null }),
        makeItem({ id: "sold" }),
      ],
      "month",
      NOW,
      null,
    );

    expect(view.sales.map((sale) => sale.id)).toEqual(["sold"]);
    expect(view.summary.count).toBe(1);
  });

  it("preserves normalized soldAt-descending order and the id tie-break", () => {
    const view = buildSalesView(
      [
        makeItem({ id: "older", soldDate: "2026-07-02T00:00:00.000Z" }),
        makeItem({ id: "same-b", soldDate: "2026-07-20T00:00:00.000Z" }),
        makeItem({ id: "newest", soldDate: "2026-07-30T00:00:00.000Z" }),
        makeItem({ id: "same-a", soldDate: "2026-07-20T00:00:00.000Z" }),
      ],
      "month",
      NOW,
      null,
    );

    expect(view.sales.map((sale) => sale.id)).toEqual([
      "newest",
      "same-a",
      "same-b",
      "older",
    ]);
  });

  it("keeps a sold row with a null sold price and normalizes its price to zero", () => {
    const view = buildSalesView(
      [makeItem({ id: "no-price", soldPrice: null })],
      "month",
      NOW,
      null,
    );

    expect(view.sales[0]).toMatchObject({
      id: "no-price",
      soldPrice: 0,
      profit: -50,
    });
    expect(view.summary).toMatchObject({ revenue: 0, count: 1, profit: -50 });
  });
});

describe("sales view reconciliation", () => {
  const items = [
    makeItem({
      id: "ebay-standard",
      soldDate: "2026-07-31T00:00:00.000Z",
      soldPlatform: "EBAY",
      soldPrice: 120,
      purchasePrice: 50,
      platformFees: 12,
    }),
    makeItem({
      id: "depop-zero-fee",
      soldDate: "2026-07-30T00:00:00.000Z",
      soldPlatform: "DEPOP",
      soldPrice: 50,
      purchasePrice: 20,
      platformFees: 0,
    }),
    makeItem({
      id: "facebook-zero-cost",
      soldDate: "2026-07-29T00:00:00.000Z",
      soldPlatform: "FB_MARKETPLACE",
      soldPrice: 40,
      purchasePrice: 0,
      platformFees: 4,
    }),
    makeItem({
      id: "ebay-loss",
      soldDate: "2026-07-28T00:00:00.000Z",
      soldPlatform: "EBAY",
      soldPrice: 20,
      purchasePrice: 40,
      platformFees: 5,
    }),
  ];

  it.each<[SalesRange]>([["week"], ["month"], ["year"], ["all"]])(
    "keeps ledger totals equal to KPI totals for %s",
    (range) => {
      const view = buildSalesView(
        items,
        range,
        NOW,
        new Date("2026-07-28T00:00:00.000Z"),
      );

      expect(
        summarize(sortSoldItems(view.sales, { field: "profit", dir: "asc" })),
      ).toEqual(view.summary);
      expect(view.sales.length).toBe(view.summary.count);
    },
  );
});

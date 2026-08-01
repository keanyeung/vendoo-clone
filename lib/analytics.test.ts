import { describe, expect, it } from "vitest";
import type { ItemDto } from "./item-dto";
import {
  bucketProfit,
  filterSales,
  platformSplit,
  previousBounds,
  rangeBounds,
  summarize,
  toSales,
  type RangeBounds,
  type Sale,
} from "./analytics";

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
    ...overrides,
  };
}

function makeSale(overrides: Partial<ItemDto> = {}): Sale {
  const sale = toSales([makeItem(overrides)])[0];
  if (sale === undefined) {
    throw new Error("Sale fixture must produce a normalized sale");
  }
  return sale;
}

function isoBounds(bounds: RangeBounds): { start: string; end: string } {
  return {
    start: bounds.start.toISOString(),
    end: bounds.end.toISOString(),
  };
}

describe("rangeBounds", () => {
  const now = new Date("2026-07-31T12:00:00.000Z");

  it("returns exact UTC windows for all four ranges", () => {
    const earliest = new Date("2025-08-03T17:45:00.000Z");

    expect(isoBounds(rangeBounds("week", now, earliest))).toEqual({
      start: "2026-07-27T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    });
    expect(isoBounds(rangeBounds("month", now, earliest))).toEqual({
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    });
    expect(isoBounds(rangeBounds("year", now, earliest))).toEqual({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    });
    expect(isoBounds(rangeBounds("all", now, earliest))).toEqual({
      start: "2025-08-03T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    });
  });

  it("uses a one-day all-time fallback when no earliest sale exists", () => {
    expect(isoBounds(rangeBounds("all", now, null))).toEqual({
      start: "2026-07-31T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    });
  });

  it("also uses the fallback for an earliest date at or after the end", () => {
    const future = new Date("2026-08-01T00:00:00.000Z");
    expect(isoBounds(rangeBounds("all", now, future))).toEqual({
      start: "2026-07-31T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    });
  });
});

describe("previousBounds", () => {
  it("returns the equal-length window before a 31-day July window", () => {
    const bounds = previousBounds({
      start: new Date("2026-07-01T00:00:00.000Z"),
      end: new Date("2026-08-01T00:00:00.000Z"),
    });

    // Equal elapsed time, rather than the previous calendar month, makes 31 days reach back past June 1.
    expect(isoBounds(bounds)).toEqual({
      start: "2026-05-31T00:00:00.000Z",
      end: "2026-07-01T00:00:00.000Z",
    });
  });

  it("returns Jan 4 through Feb 1 before a 28-day February window", () => {
    const bounds = previousBounds({
      start: new Date("2026-02-01T00:00:00.000Z"),
      end: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(isoBounds(bounds)).toEqual({
      start: "2026-01-04T00:00:00.000Z",
      end: "2026-02-01T00:00:00.000Z",
    });
  });
});

describe("toSales and summaries", () => {
  it("normalizes eligible rows, applies zero defaults, and sorts newest first", () => {
    const sales = toSales([
      makeItem({ id: "draft", status: "DRAFT" }),
      makeItem({ id: "undated", soldDate: null }),
      makeItem({
        id: "older",
        photos: ["older.jpg", "ignored.jpg"],
        soldDate: "2026-07-10T00:00:00.000Z",
      }),
      makeItem({
        id: "newer",
        soldDate: "2026-07-20T00:00:00.000Z",
        soldPrice: null,
        platformFees: null,
      }),
    ]);

    expect(sales.map((sale: Sale) => sale.id)).toEqual(["newer", "older"]);
    expect(sales[0]).toMatchObject({
      soldPrice: 0,
      fees: 0,
      profit: -40,
      photo: null,
    });
    expect(sales[1]?.photo).toBe("older.jpg");
  });

  it("uses id ascending to break equal sold-date ties", () => {
    const sales = toSales([makeItem({ id: "b" }), makeItem({ id: "a" })]);
    expect(sales.map((sale: Sale) => sale.id)).toEqual(["a", "b"]);
  });

  it("returns null ROI for zero cost on both the sale and summary", () => {
    const sale = makeSale({ purchasePrice: 0, soldPrice: 20, platformFees: 2 });
    expect(sale.roiPct).toBeNull();
    expect(summarize([sale]).roiPct).toBeNull();
  });

  it("preserves negative profitability and excludes it from platform slices", () => {
    const sale = makeSale({
      purchasePrice: 80,
      soldPrice: 50,
      platformFees: 10,
      soldPlatform: "DEPOP",
    });
    const summary = summarize([sale]);

    expect(sale.profit).toBe(-40);
    expect(summary.marginPct).toBe(-80);
    expect(platformSplit([sale])).toEqual([]);
  });

  it("returns finite zeros and null averages and ratios for no sales", () => {
    const summary = summarize([]);
    expect(summary).toEqual({
      revenue: 0,
      cost: 0,
      fees: 0,
      profit: 0,
      count: 0,
      avgProfit: null,
      avgDaysToSell: null,
      marginPct: null,
      roiPct: null,
    });
    expect(
      Object.values(summary).some(
        (value: number | null) => typeof value === "number" && Number.isNaN(value),
      ),
    ).toBe(false);
  });

  it("rounds only after accumulating summary totals", () => {
    const sales = [
      { ...makeSale({ id: "one" }), soldPrice: 0.005, profit: 0.005 },
      { ...makeSale({ id: "two" }), soldPrice: 0.005, profit: 0.005 },
    ];
    expect(summarize(sales)).toMatchObject({ revenue: 0.01, profit: 0.01 });
  });
});

describe("filterSales", () => {
  it("includes the last millisecond of July and excludes the August boundary", () => {
    const bounds = {
      start: new Date("2026-07-01T00:00:00.000Z"),
      end: new Date("2026-08-01T00:00:00.000Z"),
    };
    const inside = makeSale({
      id: "inside",
      soldDate: "2026-07-31T23:59:59.999Z",
    });
    const outside = makeSale({
      id: "outside",
      soldDate: "2026-08-01T00:00:00.000Z",
    });

    expect(filterSales([inside, outside], bounds).map((sale: Sale) => sale.id)).toEqual([
      "inside",
    ]);
  });
});

describe("platformSplit", () => {
  it("excludes null platforms and orders positive slices by descending profit", () => {
    const split = platformSplit([
      makeSale({ id: "ebay", soldPlatform: "EBAY", soldPrice: 100 }),
      makeSale({ id: "depop", soldPlatform: "DEPOP", soldPrice: 80 }),
      makeSale({ id: "unknown", soldPlatform: null, soldPrice: 200 }),
    ]);

    expect(split.map((slice) => slice.platform)).toEqual(["EBAY", "DEPOP"]);
    expect(split.reduce((total, slice) => total + slice.sharePct, 0)).toBeCloseTo(
      100,
      1,
    );
  });

  it("uses the platform enum value ascending to break profit ties", () => {
    const split = platformSplit([
      makeSale({ id: "ebay", soldPlatform: "EBAY" }),
      makeSale({ id: "depop", soldPlatform: "DEPOP" }),
    ]);
    expect(split.map((slice) => slice.platform)).toEqual(["DEPOP", "EBAY"]);
  });
});

describe("bucketProfit", () => {
  it("separates Sunday and Monday across an ISO-week boundary", () => {
    const buckets = bucketProfit(
      [
        makeSale({ id: "sunday", soldDate: "2026-07-26T23:00:00.000Z" }),
        makeSale({ id: "monday", soldDate: "2026-07-27T00:00:00.000Z" }),
      ],
      {
        start: new Date("2026-07-20T00:00:00.000Z"),
        end: new Date("2026-08-03T00:00:00.000Z"),
      },
      "week",
    );

    expect(buckets.map((bucket) => [bucket.key, bucket.count])).toEqual([
      ["2026-07-20", 1],
      ["2026-07-27", 1],
    ]);
  });

  it("emits an empty week and aligns the first week before the month start", () => {
    const buckets = bucketProfit(
      [
        makeSale({ id: "first", soldDate: "2026-07-02T00:00:00.000Z" }),
        makeSale({ id: "third", soldDate: "2026-07-16T00:00:00.000Z" }),
      ],
      {
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: new Date("2026-08-01T00:00:00.000Z"),
      },
      "week",
    );

    expect(buckets[0]?.key).toBe("2026-06-29");
    expect(buckets.find((bucket) => bucket.key === "2026-07-06")).toMatchObject({
      count: 0,
      profit: 0,
      revenue: 0,
    });
  });

  it("emits exactly one chronological bucket per day including trailing gaps", () => {
    const buckets = bucketProfit(
      [makeSale({ soldDate: "2026-07-27T12:00:00.000Z" })],
      {
        start: new Date("2026-07-27T00:00:00.000Z"),
        end: new Date("2026-08-03T00:00:00.000Z"),
      },
      "day",
    );

    expect(buckets).toHaveLength(7);
    expect(buckets.map((bucket) => bucket.key)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
    expect(buckets.map((bucket) => bucket.count)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });

  it("uses consistent suffixed month labels only when the series spans years", () => {
    const spanning = bucketProfit(
      [],
      {
        start: new Date("2025-12-01T00:00:00.000Z"),
        end: new Date("2026-02-01T00:00:00.000Z"),
      },
      "month",
    );
    const singleYear = bucketProfit(
      [],
      {
        start: new Date("2026-06-01T00:00:00.000Z"),
        end: new Date("2026-08-01T00:00:00.000Z"),
      },
      "month",
    );

    expect(spanning.map((bucket) => bucket.label)).toEqual(["Dec '25", "Jan '26"]);
    expect(singleYear.map((bucket) => bucket.label)).toEqual(["Jun", "Jul"]);
  });

  it("ignores sales outside bounds even when they share an aligned bucket", () => {
    const buckets = bucketProfit(
      [makeSale({ soldDate: "2026-06-30T00:00:00.000Z" })],
      {
        start: new Date("2026-07-01T00:00:00.000Z"),
        end: new Date("2026-08-01T00:00:00.000Z"),
      },
      "week",
    );
    expect(buckets[0]?.count).toBe(0);
  });
});

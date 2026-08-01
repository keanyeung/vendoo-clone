import { describe, expect, it } from "vitest";
import type { Sale } from "./analytics";
import {
  DEFAULT_SOLD_ITEMS_SORT,
  sortSoldItems,
  type SoldItemsSort,
} from "./sold-items-sort";

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "item-1",
    title: "Test item",
    category: null,
    size: null,
    photo: null,
    platform: "EBAY",
    soldAt: "2026-07-15T00:00:00.000Z",
    listedAt: "2026-07-01T00:00:00.000Z",
    soldPrice: 50,
    purchasePrice: 20,
    fees: 5,
    profit: 25,
    roiPct: 125,
    daysToSell: 14,
    ...overrides,
  };
}

function ids(sales: Sale[], sort: SoldItemsSort): string[] {
  return sortSoldItems(sales, sort).map((item) => item.id);
}

describe("sortSoldItems", () => {
  it("defaults to sold date descending", () => {
    expect(
      ids(
        [
          sale({ id: "older", soldAt: "2026-07-01T00:00:00.000Z" }),
          sale({ id: "newer", soldAt: "2026-07-30T00:00:00.000Z" }),
        ],
        DEFAULT_SOLD_ITEMS_SORT,
      ),
    ).toEqual(["newer", "older"]);
  });

  it("sorts titles case-insensitively", () => {
    expect(
      ids(
        [
          sale({ id: "b", title: "alpha" }),
          sale({ id: "a", title: "Alpha" }),
        ],
        { field: "title", dir: "asc" },
      ),
    ).toEqual(["a", "b"]);
  });

  it("puts null ROI last descending and first ascending", () => {
    const sales = [
      sale({ id: "known", roiPct: 25 }),
      sale({ id: "missing", roiPct: null }),
    ];

    expect(ids(sales, { field: "roi", dir: "desc" })).toEqual([
      "known",
      "missing",
    ]);
    expect(ids(sales, { field: "roi", dir: "asc" })).toEqual([
      "missing",
      "known",
    ]);
  });

  it("uses id ascending to break equal field values", () => {
    expect(
      ids(
        [sale({ id: "z", profit: 10 }), sale({ id: "a", profit: 10 })],
        { field: "profit", dir: "desc" },
      ),
    ).toEqual(["a", "z"]);
  });

  it.each([
    ["soldPrice", { soldPrice: 100 }, { soldPrice: 9 }],
    ["profit", { profit: 100 }, { profit: 9 }],
    ["roi", { roiPct: 100 }, { roiPct: 9 }],
  ] as const)("sorts %s numerically rather than lexically", (field, high, low) => {
    expect(
      ids(
        [sale({ id: "high", ...high }), sale({ id: "low", ...low })],
        { field, dir: "asc" },
      ),
    ).toEqual(["low", "high"]);
  });

  it("does not mutate the input array", () => {
    const sales = [sale({ id: "b", soldPrice: 100 }), sale({ id: "a", soldPrice: 9 })];
    const original = [...sales];

    sortSoldItems(sales, { field: "soldPrice", dir: "asc" });

    expect(sales).toEqual(original);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics", async () => import("./analytics"));
vi.mock("@/lib/listing-sort", async () => import("./listing-sort"));

import { computeDashboard } from "./dashboard";
import type { ItemDto } from "./item-dto";
import { buildSalesView } from "./sales-view";

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

const NOW = new Date("2026-07-15T12:00:00.000Z");
const EARLIEST = new Date("2025-12-20T00:00:00.000Z");

const staleDraft = makeItem({
  id: "stale-draft",
  title: "Stale draft",
  updatedAt: "2026-07-15T11:00:00.000Z",
  status: "DRAFT",
  soldPrice: null,
  soldPlatform: null,
  soldDate: null,
  platformFees: null,
});
const agingListing = makeItem({
  id: "aging-listing",
  title: "Aging listing",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-07-15T10:00:00.000Z",
  listPrice: 150,
  status: "LISTED",
  soldPrice: null,
  soldPlatform: null,
  soldDate: null,
  platformFees: null,
});
const currentSale = makeItem({
  id: "current-sale",
  title: "Current sale",
  updatedAt: "2026-07-14T00:00:00.000Z",
  category: "Shoes",
  soldDate: "2026-07-10T00:00:00.000Z",
  soldPrice: 120,
  purchasePrice: 50,
  platformFees: 12,
});
const futureMonthSale = makeItem({
  id: "future-month-sale",
  title: "Future month sale",
  updatedAt: "2026-07-13T00:00:00.000Z",
  category: "Clothing",
  soldDate: "2026-07-25T00:00:00.000Z",
  soldPrice: 200,
  purchasePrice: 80,
  platformFees: 20,
});
const futureYearSale = makeItem({
  id: "future-year-sale",
  title: "Future year sale",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
  category: "Clothing",
  soldDate: "2026-09-10T00:00:00.000Z",
  soldPrice: 300,
  purchasePrice: 100,
  platformFees: 30,
});
const previousMonthSale = makeItem({
  id: "previous-month-sale",
  title: "Previous month sale",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z",
  category: "Shoes",
  soldDate: "2026-06-20T00:00:00.000Z",
  soldPrice: 80,
  purchasePrice: 30,
  platformFees: 8,
});
const previousYearSale = makeItem({
  id: "previous-year-sale",
  title: "Previous year sale",
  createdAt: "2025-12-01T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
  category: "Toys",
  soldDate: "2025-12-20T00:00:00.000Z",
  soldPrice: 60,
  purchasePrice: 25,
  platformFees: 5,
});
const nullPriceSale = makeItem({
  id: "null-price-sale",
  title: "Null price sale",
  updatedAt: "2026-07-09T00:00:00.000Z",
  category: "Clothing",
  soldDate: "2026-07-05T00:00:00.000Z",
  soldPrice: null,
  purchasePrice: 40,
  platformFees: 7,
});
const zeroCostSale = makeItem({
  id: "zero-cost-sale",
  title: "Zero cost sale",
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-08T00:00:00.000Z",
  category: "Shoes",
  soldDate: "2026-07-08T00:00:00.000Z",
  soldPrice: 50,
  purchasePrice: 0,
  platformFees: 5,
});
const negativeProfitSale = makeItem({
  id: "negative-profit-sale",
  title: "Negative profit sale",
  updatedAt: "2026-07-07T00:00:00.000Z",
  category: "Shoes",
  soldDate: "2026-07-12T00:00:00.000Z",
  soldPrice: 30,
  purchasePrice: 60,
  platformFees: 5,
});
const missingFeesSale = makeItem({
  id: "missing-fees-sale",
  title: "Missing fees sale",
  createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
  category: "Clothing",
  soldDate: "2026-06-25T00:00:00.000Z",
  soldPrice: 70,
  purchasePrice: 20,
  platformFees: null,
});

const items = [
  previousYearSale,
  previousMonthSale,
  missingFeesSale,
  currentSale,
  nullPriceSale,
  zeroCostSale,
  negativeProfitSale,
  futureMonthSale,
  futureYearSale,
  staleDraft,
  agingListing,
];

describe("computeDashboard", () => {
  it("characterizes the complete dashboard summary", () => {
    expect(computeDashboard(items, NOW)).toEqual({
      revenueThisMonth: 200, // Was 400; month-to-date excludes the forward-dated July sale.
      profitThisMonth: 21, // Was 168; excludes $100 of forward profit and keeps the null-price sale's $47 loss.
      salesThisMonth: 4, // Was 5; month-to-date excludes the forward-dated July sale.
      revenueYtd: 350, // Was 850; year-to-date excludes the forward-dated July and September sales.
      marginThisMonthPct: 10.5, // Was 42; reflects both the excluded forward sale and retained null-price loss.
      activeListings: 1,
      draftCount: 1,
      soldCount: 9,
      inventoryValue: 150,
      avgDaysToSell: 40,
      avgDaysToSellPrevMonth: 17,
      sellThroughPct: 90,
      topCategory: "Clothing",
      bestMonth: {
        key: "2026-09",
        label: "Sep 2026",
        profit: 170,
        revenue: 300,
        itemsSold: 1,
      },
      avgProfitPerItem: 51.11,
      monthly: [
        {
          key: "2026-04",
          label: "Apr 2026",
          profit: 0,
          revenue: 0,
          itemsSold: 0,
        },
        {
          key: "2026-05",
          label: "May 2026",
          profit: 0,
          revenue: 0,
          itemsSold: 0,
        },
        {
          key: "2026-06",
          label: "Jun 2026",
          profit: 92,
          revenue: 150,
          itemsSold: 2,
        },
        {
          key: "2026-07",
          label: "Jul 2026",
          profit: 168,
          revenue: 400,
          itemsSold: 5,
        },
        {
          key: "2026-08",
          label: "Aug 2026",
          profit: 0,
          revenue: 0,
          itemsSold: 0,
        },
        {
          key: "2026-09",
          label: "Sep 2026",
          profit: 170,
          revenue: 300,
          itemsSold: 1,
        },
      ],
      recent: [
        staleDraft,
        agingListing,
        currentSale,
        futureMonthSale,
        futureYearSale,
      ],
      attention: [
        {
          kind: "stale_draft",
          title: "1 draft never published",
          detail: "Oldest added 14 days ago",
          action: "Review",
          href: "/listings?status=DRAFT",
          count: 1,
        },
        {
          kind: "aging_listing",
          title: "1 listing over 45 days",
          detail: "Consider a price drop",
          action: "Price",
          href: "/listings?status=LISTED&sort=added-asc",
          count: 1,
        },
        {
          kind: "missing_fees",
          title: "1 sale missing fees",
          detail: "Profit is overstated",
          action: "Fix",
          href: "/listings?status=SOLD",
          count: 1,
        },
      ],
      totalItems: 11,
    });
  });
});

describe("dashboard and analytics reconciliation", () => {
  it("keeps month-to-date homepage figures equal to the analytics view", () => {
    const dashboard = computeDashboard(items, NOW);
    const view = buildSalesView(items, "month", NOW, EARLIEST);

    expect(dashboard.revenueThisMonth).toBe(view.summary.revenue);
    expect(dashboard.profitThisMonth).toBe(view.summary.profit);
    expect(dashboard.salesThisMonth).toBe(view.summary.count);
    expect(dashboard.marginThisMonthPct).toBe(view.summary.marginPct);
  });
});

import {
  computeAnalytics,
  computeProfit,
  filterSoldByRange,
} from "@/lib/analytics";
import type { MonthlyBucket } from "@/lib/analytics";
import type { ItemDto } from "@/lib/item-dto";
import { daysListed } from "@/lib/listing-sort";

// Every figure the homepage renders, computed in one pass from rows the page already fetched.
export type AttentionItem = {
  kind: "stale_draft" | "aging_listing" | "missing_fees";
  title: string;
  detail: string;
  action: string;
  href: string;
  count: number;
};

export type DashboardSummary = {
  revenueThisMonth: number;
  profitThisMonth: number;
  salesThisMonth: number;
  revenueYtd: number;
  marginThisMonthPct: number | null;
  activeListings: number;
  draftCount: number;
  soldCount: number;
  inventoryValue: number;
  avgDaysToSell: number | null;
  avgDaysToSellPrevMonth: number | null;
  sellThroughPct: number | null;
  topCategory: string | null;
  bestMonth: MonthlyBucket | null;
  avgProfitPerItem: number | null;
  monthly: MonthlyBucket[];
  recent: ItemDto[];
  attention: AttentionItem[];
  totalItems: number;
};

// Analytics keeps its own copy of this private; duplicating six lines beats widening that module's API for one caller.
function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

// UTC, like filterSoldByRange, because soldDate is stored as UTC midnight from a date picker.
function isInUtcMonth(
  iso: string | null,
  year: number,
  monthIndex: number,
): boolean {
  if (iso === null) {
    return false;
  }

  const soldDate = new Date(iso);
  return (
    soldDate.getUTCFullYear() === year && soldDate.getUTCMonth() === monthIndex
  );
}

function averageDaysToSell(items: ItemDto[], nowMs: number): number | null {
  if (items.length === 0) {
    return null;
  }

  let totalDays = 0;
  for (const item of items) {
    totalDays += daysListed(item, nowMs);
  }

  return round(totalDays / items.length, 0);
}

function pickTopCategory(soldItems: ItemDto[]): string | null {
  const profitByCategory = new Map<string, number>();

  for (const item of soldItems) {
    if (item.category === null) {
      continue;
    }

    const total = profitByCategory.get(item.category) ?? 0;
    profitByCategory.set(item.category, total + (computeProfit(item) ?? 0));
  }

  let topCategory: string | null = null;
  let topProfit = 0;

  // Seeding from the first entry rather than zero keeps an all-loss inventory from reporting no top category.
  for (const [category, profit] of profitByCategory) {
    const wins =
      topCategory === null ||
      profit > topProfit ||
      // Alphabetical tie-break so a redeploy never reshuffles the rendered value.
      (profit === topProfit && category < topCategory);

    if (wins) {
      topCategory = category;
      topProfit = profit;
    }
  }

  return topCategory;
}

function pickBestMonth(monthly: MonthlyBucket[]): MonthlyBucket | null {
  let best: MonthlyBucket | null = null;

  for (const bucket of monthly) {
    if (best === null || bucket.profit > best.profit) {
      best = bucket;
    }
  }

  return best;
}

function buildAttention(items: ItemDto[], nowMs: number): AttentionItem[] {
  const staleDrafts = items.filter(
    (item: ItemDto) => item.status === "DRAFT" && daysListed(item, nowMs) > 7,
  );
  const agingListings = items.filter(
    (item: ItemDto) => item.status === "LISTED" && daysListed(item, nowMs) > 45,
  );
  const missingFees = items.filter(
    (item: ItemDto) => item.status === "SOLD" && item.platformFees === null,
  );

  let oldestDraftDays = 0;
  for (const item of staleDrafts) {
    oldestDraftDays = Math.max(oldestDraftDays, daysListed(item, nowMs));
  }

  const candidates: AttentionItem[] = [
    {
      kind: "stale_draft",
      title: `${staleDrafts.length} ${staleDrafts.length === 1 ? "draft" : "drafts"} never published`,
      detail: `Oldest added ${oldestDraftDays} days ago`,
      action: "Review",
      href: "/listings?status=DRAFT",
      count: staleDrafts.length,
    },
    {
      kind: "aging_listing",
      title: `${agingListings.length} ${agingListings.length === 1 ? "listing" : "listings"} over 45 days`,
      detail: "Consider a price drop",
      action: "Price",
      // "oldest" rather than "added-asc": both parse to the same token, but only the legacy
      // aliases pass the isSortValue() guard that drives the Sort control on /listings.
      href: "/listings?status=LISTED&sort=oldest",
      count: agingListings.length,
    },
    {
      kind: "missing_fees",
      title: `${missingFees.length} ${missingFees.length === 1 ? "sale" : "sales"} missing fees`,
      detail: "Profit is overstated",
      action: "Fix",
      href: "/listings?status=SOLD",
      count: missingFees.length,
    },
  ];

  // Sort is stable, so equal counts fall back to the declaration order above.
  return candidates
    .filter((entry: AttentionItem) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export function computeDashboard(
  items: ItemDto[],
  now: Date,
): DashboardSummary {
  const nowMs = now.getTime();
  const monthSales = filterSoldByRange(items, "month", now);
  const yearSales = filterSoldByRange(items, "year", now);
  const soldItems = items.filter((item: ItemDto) => item.status === "SOLD");
  // One all-time roll-up, reused, so the homepage can never disagree with /analytics.
  const allTime = computeAnalytics(items, "all", now);
  const monthly = allTime.monthly.slice(-6);

  let revenueThisMonth = 0;
  let profitThisMonth = 0;
  for (const item of monthSales) {
    revenueThisMonth += item.soldPrice ?? 0;
    profitThisMonth += computeProfit(item) ?? 0;
  }

  let revenueYtd = 0;
  for (const item of yearSales) {
    revenueYtd += item.soldPrice ?? 0;
  }

  let activeListings = 0;
  let draftCount = 0;
  let inventoryValue = 0;
  for (const item of items) {
    if (item.status === "LISTED") {
      activeListings += 1;
      inventoryValue += item.listPrice;
    } else if (item.status === "DRAFT") {
      draftCount += 1;
    }
  }

  const soldCount = soldItems.length;
  const datedSales = soldItems.filter((item: ItemDto) => item.soldDate !== null);
  const prevMonthIndex = (now.getUTCMonth() + 11) % 12;
  // January rolls back to the previous December.
  const prevMonthYear =
    now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const prevMonthSales = datedSales.filter((item: ItemDto) =>
    isInUtcMonth(item.soldDate, prevMonthYear, prevMonthIndex),
  );
  const sellThroughBase = soldCount + activeListings;

  const recent = [...items]
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5);

  // Round returned values once, after accumulation, to avoid compounding drift.
  return {
    revenueThisMonth: round(revenueThisMonth, 2),
    profitThisMonth: round(profitThisMonth, 2),
    salesThisMonth: monthSales.length,
    revenueYtd: round(revenueYtd, 2),
    marginThisMonthPct:
      revenueThisMonth === 0
        ? null
        : round((profitThisMonth / revenueThisMonth) * 100, 1),
    activeListings,
    draftCount,
    soldCount,
    inventoryValue: round(inventoryValue, 2),
    avgDaysToSell: averageDaysToSell(datedSales, nowMs),
    avgDaysToSellPrevMonth: averageDaysToSell(prevMonthSales, nowMs),
    sellThroughPct:
      sellThroughBase === 0
        ? null
        : round((soldCount / sellThroughBase) * 100, 1),
    topCategory: pickTopCategory(soldItems),
    bestMonth: pickBestMonth(monthly),
    avgProfitPerItem: allTime.avgProfitPerItem,
    monthly,
    recent,
    attention: buildAttention(items, nowMs),
    totalItems: items.length,
  };
}

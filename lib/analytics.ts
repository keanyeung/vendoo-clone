import type { ItemDto } from "@/lib/item-dto";

// Single source of truth for profit math and dashboard aggregation, shared by the item detail page and analytics page.
export type SellableItem = Pick<
  ItemDto,
  "soldPrice" | "purchasePrice" | "platformFees"
>;

export function computeProfit(item: SellableItem): number | null {
  if (item.soldPrice === null) {
    return null;
  }

  return item.soldPrice - item.purchasePrice - (item.platformFees ?? 0);
}

export function computeRoi(item: SellableItem): number | null {
  const profit = computeProfit(item);

  // A free find is valid data, but its ROI cannot be calculated.
  if (profit === null || item.purchasePrice === 0) {
    return null;
  }

  return (profit / item.purchasePrice) * 100;
}

export type AnalyticsRange = "all" | "year" | "month";

export const ANALYTICS_RANGES = [
  "all",
  "year",
  "month",
] as const satisfies readonly AnalyticsRange[];

export const RANGE_LABELS = {
  all: "All time",
  year: "This year",
  month: "This month",
} satisfies Record<AnalyticsRange, string>;

export function isAnalyticsRange(value: string): value is AnalyticsRange {
  return ANALYTICS_RANGES.some(
    (analyticsRange: AnalyticsRange) => analyticsRange === value,
  );
}

export function filterSoldByRange(
  items: ItemDto[],
  range: AnalyticsRange,
  now: Date,
): ItemDto[] {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  // UTC bucketing matches the UTC-midnight sale dates and avoids month-boundary shifts.
  return items.filter((item: ItemDto) => {
    if (item.status !== "SOLD" || item.soldDate === null) {
      return false;
    }

    if (range === "all") {
      return true;
    }

    const soldDate = new Date(item.soldDate);
    const isCurrentYear = soldDate.getUTCFullYear() === currentYear;

    return range === "year"
      ? isCurrentYear
      : isCurrentYear && soldDate.getUTCMonth() === currentMonth;
  });
}

export type MonthlyBucket = {
  key: string;
  label: string;
  profit: number;
  revenue: number;
  itemsSold: number;
};

export type AnalyticsSummary = {
  itemsSold: number;
  totalRevenue: number;
  totalCogs: number;
  totalFees: number;
  totalProfit: number;
  allTimeProfit: number;
  avgProfitPerItem: number | null;
  overallMarginPct: number | null;
  overallRoiPct: number | null;
  monthly: MonthlyBucket[];
};

type MonthlyAccumulator = {
  profit: number;
  revenue: number;
  itemsSold: number;
};

function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthlyBuckets(items: ItemDto[]): MonthlyBucket[] {
  const buckets = new Map<string, MonthlyAccumulator>();

  for (const item of items) {
    if (item.soldDate === null) {
      continue;
    }

    const key = monthKey(new Date(item.soldDate));
    const existing = buckets.get(key) ?? {
      profit: 0,
      revenue: 0,
      itemsSold: 0,
    };

    existing.profit += computeProfit(item) ?? 0;
    existing.revenue += item.soldPrice ?? 0;
    existing.itemsSold += 1;
    buckets.set(key, existing);
  }

  const sortedKeys = [...buckets.keys()].sort();
  const firstKey = sortedKeys[0];
  const lastKey = sortedKeys.at(-1);

  if (firstKey === undefined || lastKey === undefined) {
    return [];
  }

  const [firstYearText, firstMonthText] = firstKey.split("-");
  const [lastYearText, lastMonthText] = lastKey.split("-");
  let year = Number(firstYearText);
  let month = Number(firstMonthText) - 1;
  const lastYear = Number(lastYearText);
  const lastMonth = Number(lastMonthText) - 1;
  const monthly: MonthlyBucket[] = [];

  // Fill missing months so charts show sale cadence as a continuous timeline.
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const date = new Date(Date.UTC(year, month, 1));
    const key = monthKey(date);
    const bucket = buckets.get(key);

    monthly.push({
      key,
      label: monthLabel(year, month),
      profit: round(bucket?.profit ?? 0, 2),
      revenue: round(bucket?.revenue ?? 0, 2),
      itemsSold: bucket?.itemsSold ?? 0,
    });

    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }

  return monthly;
}

export function computeAnalytics(
  items: ItemDto[],
  range: AnalyticsRange,
  now: Date,
): AnalyticsSummary {
  const soldItems = filterSoldByRange(items, range, now);
  const allSoldItems = filterSoldByRange(items, "all", now);
  let totalRevenue = 0;
  let totalCogs = 0;
  let totalFees = 0;
  let totalProfit = 0;
  let allTimeProfit = 0;

  for (const item of soldItems) {
    totalRevenue += item.soldPrice ?? 0;
    totalCogs += item.purchasePrice;
    totalFees += item.platformFees ?? 0;
    totalProfit += computeProfit(item) ?? 0;
  }

  for (const item of allSoldItems) {
    allTimeProfit += computeProfit(item) ?? 0;
  }

  const itemsSold = soldItems.length;

  // Margin and ROI are ratios of totals, not averages of per-item ratios.
  const avgProfitPerItem =
    itemsSold === 0 ? null : totalProfit / itemsSold;
  const overallMarginPct =
    totalRevenue === 0 ? null : (totalProfit / totalRevenue) * 100;
  const overallRoiPct =
    totalCogs === 0 ? null : (totalProfit / totalCogs) * 100;

  // Round returned values once, after accumulation, to avoid compounding drift.
  return {
    itemsSold,
    totalRevenue: round(totalRevenue, 2),
    totalCogs: round(totalCogs, 2),
    totalFees: round(totalFees, 2),
    totalProfit: round(totalProfit, 2),
    allTimeProfit: round(allTimeProfit, 2),
    avgProfitPerItem:
      avgProfitPerItem === null ? null : round(avgProfitPerItem, 2),
    overallMarginPct:
      overallMarginPct === null ? null : round(overallMarginPct, 1),
    overallRoiPct:
      overallRoiPct === null ? null : round(overallRoiPct, 1),
    monthly: buildMonthlyBuckets(soldItems),
  };
}

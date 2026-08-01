import type { ItemDto } from "@/lib/item-dto";
// Keep this value import relative so zero-config Vitest can resolve it at runtime.
import { daysListed } from "./listing-sort";

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

// Analytics v2 sales-aggregation layer. It coexists with the legacy range API while consumers migrate.

export type SalesRange = "week" | "month" | "year" | "all";

export const SALES_RANGES = [
  "week",
  "month",
  "year",
  "all",
] as const satisfies readonly SalesRange[];

export const SALES_RANGE_LABELS = {
  week: "This week",
  month: "This month",
  year: "This year",
  all: "All time",
} satisfies Record<SalesRange, string>;

export function isSalesRange(value: string): value is SalesRange {
  return SALES_RANGES.some((salesRange: SalesRange) => salesRange === value);
}

export type Sale = {
  id: string;
  title: string;
  category: string | null;
  size: string | null;
  photo: string | null;
  platform: NonNullable<ItemDto["soldPlatform"]> | null;
  soldAt: string;
  listedAt: string;
  soldPrice: number;
  purchasePrice: number;
  fees: number;
  profit: number;
  roiPct: number | null;
  daysToSell: number;
};

export function toSales(items: ItemDto[]): Sale[] {
  const sales: Sale[] = [];

  for (const item of items) {
    if (item.status !== "SOLD" || item.soldDate === null) {
      continue;
    }

    // Unlike computeProfit, the ledger retains sold rows with no recorded price and treats that price as zero.
    const soldPrice = item.soldPrice ?? 0;
    const fees = item.platformFees ?? 0;
    const profit = round(soldPrice - item.purchasePrice - fees, 2);

    sales.push({
      id: item.id,
      title: item.title,
      category: item.category,
      size: item.size,
      photo: item.photos[0] ?? null,
      platform: item.soldPlatform,
      soldAt: item.soldDate,
      listedAt: item.createdAt,
      soldPrice,
      purchasePrice: item.purchasePrice,
      fees,
      profit,
      roiPct:
        item.purchasePrice === 0
          ? null
          : round((profit / item.purchasePrice) * 100, 1),
      // Passing the known sale time avoids evaluating daysListed's live-clock fallback.
      daysToSell: daysListed(item, Date.parse(item.soldDate)),
    });
  }

  return sales.sort(
    (a, b) =>
      Date.parse(b.soldAt) - Date.parse(a.soldAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export type RangeBounds = {
  start: Date;
  end: Date;
};

function utcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function rangeBounds(
  range: SalesRange,
  now: Date,
  earliest: Date | null,
): RangeBounds {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  const fallbackStart = new Date(Date.UTC(year, month, date));
  const end = new Date(Date.UTC(year, month, date + 1));
  let start: Date;

  if (range === "week") {
    const mondayOffset = (now.getUTCDay() + 6) % 7;
    start = new Date(Date.UTC(year, month, date - mondayOffset));
  } else if (range === "month") {
    start = new Date(Date.UTC(year, month, 1));
  } else if (range === "year") {
    start = new Date(Date.UTC(year, 0, 1));
  } else {
    start = earliest === null ? fallbackStart : utcMidnight(earliest);

    // An invalid future earliest date must not turn the all-time range into an empty or reversed window.
    if (start.getTime() >= end.getTime()) {
      start = fallbackStart;
    }
  }

  return { start, end };
}

export function previousBounds(bounds: RangeBounds): RangeBounds {
  const span = bounds.end.getTime() - bounds.start.getTime();

  // Equal elapsed windows make comparisons fair even though they are not always calendar periods.
  return {
    start: new Date(bounds.start.getTime() - span),
    end: new Date(bounds.start.getTime()),
  };
}

export function filterSales(sales: Sale[], bounds: RangeBounds): Sale[] {
  const startMs = bounds.start.getTime();
  const endMs = bounds.end.getTime();

  return sales.filter((sale: Sale) => {
    const soldMs = Date.parse(sale.soldAt);
    return soldMs >= startMs && soldMs < endMs;
  });
}

export type SalesSummary = {
  revenue: number;
  cost: number;
  fees: number;
  profit: number;
  count: number;
  avgProfit: number | null;
  avgDaysToSell: number | null;
  marginPct: number | null;
  roiPct: number | null;
};

export function summarize(sales: Sale[]): SalesSummary {
  let revenue = 0;
  let cost = 0;
  let fees = 0;
  let profit = 0;
  let daysToSell = 0;

  for (const sale of sales) {
    revenue += sale.soldPrice;
    cost += sale.purchasePrice;
    fees += sale.fees;
    profit += sale.profit;
    daysToSell += sale.daysToSell;
  }

  const count = sales.length;

  // Ratios use accumulated totals so high- and low-value sales retain their proper weight.
  return {
    revenue: round(revenue, 2),
    cost: round(cost, 2),
    fees: round(fees, 2),
    profit: round(profit, 2),
    count,
    avgProfit: count === 0 ? null : round(profit / count, 2),
    avgDaysToSell: count === 0 ? null : round(daysToSell / count, 0),
    marginPct: revenue === 0 ? null : round((profit / revenue) * 100, 1),
    roiPct: cost === 0 ? null : round((profit / cost) * 100, 1),
  };
}

export type PlatformSlice = {
  platform: NonNullable<ItemDto["soldPlatform"]>;
  profit: number;
  sharePct: number;
};

export function platformSplit(sales: Sale[]): PlatformSlice[] {
  const profitByPlatform = new Map<
    NonNullable<ItemDto["soldPlatform"]>,
    number
  >();

  for (const sale of sales) {
    if (sale.platform === null) {
      continue;
    }

    profitByPlatform.set(
      sale.platform,
      (profitByPlatform.get(sale.platform) ?? 0) + sale.profit,
    );
  }

  const positive = [...profitByPlatform.entries()].filter(
    ([, profit]: [NonNullable<ItemDto["soldPlatform"]>, number]) => profit > 0,
  );
  const positiveProfit = positive.reduce(
    (total, [, profit]) => total + profit,
    0,
  );

  return positive
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    )
    .map(([platform, profit]) => ({
      platform,
      profit: round(profit, 2),
      sharePct: round((profit / positiveProfit) * 100, 1),
    }));
}

export type Granularity = "day" | "week" | "month";

export const DEFAULT_GRANULARITY = {
  week: "day",
  month: "week",
  year: "month",
  all: "month",
} satisfies Record<SalesRange, Granularity>;

export type ProfitBucket = {
  key: string;
  label: string;
  tipLabel: string;
  profit: number;
  revenue: number;
  count: number;
};

type BucketAccumulator = {
  start: Date;
  end: Date;
  profit: number;
  revenue: number;
  count: number;
};

function alignBucketStart(date: Date, granularity: Granularity): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (granularity === "month") {
    return new Date(Date.UTC(year, month, 1));
  }

  if (granularity === "week") {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(year, month, day - mondayOffset));
  }

  return new Date(Date.UTC(year, month, day));
}

function nextBucketStart(date: Date, granularity: Granularity): Date {
  if (granularity === "month") {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }

  const days = granularity === "week" ? 7 : 1;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
    ),
  );
}

function bucketKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bucketLabels(
  date: Date,
  granularity: Granularity,
  spansYears: boolean,
): Pick<ProfitBucket, "label" | "tipLabel"> {
  if (granularity === "day") {
    return {
      label: date.toLocaleString("en-US", {
        weekday: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      tipLabel: date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    };
  }

  if (granularity === "week") {
    const dateLabel = date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

    return { label: dateLabel, tipLabel: `Week of ${dateLabel}` };
  }

  const shortMonth = date.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const label = spansYears
    ? date
        .toLocaleString("en-US", {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        })
        .replace(" ", " '")
    : shortMonth;

  return {
    label,
    tipLabel: date.toLocaleString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

export function bucketProfit(
  sales: Sale[],
  bounds: RangeBounds,
  granularity: Granularity,
): ProfitBucket[] {
  const accumulators: BucketAccumulator[] = [];
  let start = alignBucketStart(bounds.start, granularity);

  while (start.getTime() < bounds.end.getTime()) {
    const end = nextBucketStart(start, granularity);
    accumulators.push({ start, end, profit: 0, revenue: 0, count: 0 });
    start = end;
  }

  const boundsStartMs = bounds.start.getTime();
  const boundsEndMs = bounds.end.getTime();

  for (const sale of sales) {
    const soldMs = Date.parse(sale.soldAt);
    if (soldMs < boundsStartMs || soldMs >= boundsEndMs) {
      continue;
    }

    const bucket = accumulators.find(
      (candidate: BucketAccumulator) =>
        soldMs >= candidate.start.getTime() && soldMs < candidate.end.getTime(),
    );

    if (bucket !== undefined) {
      bucket.profit += sale.profit;
      bucket.revenue += sale.soldPrice;
      bucket.count += 1;
    }
  }

  const first = accumulators[0];
  const last = accumulators.at(-1);
  const spansYears =
    first !== undefined &&
    last !== undefined &&
    first.start.getUTCFullYear() !== last.start.getUTCFullYear();

  return accumulators.map((bucket: BucketAccumulator) => ({
    // ISO dates replace the brief's numeric key so React keys remain stable and assertions stay readable.
    key: bucketKey(bucket.start),
    ...bucketLabels(bucket.start, granularity, spansYears),
    profit: round(bucket.profit, 2),
    revenue: round(bucket.revenue, 2),
    count: bucket.count,
  }));
}

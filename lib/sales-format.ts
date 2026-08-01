import type { ItemDto } from "./item-dto";
import { SALES_RANGE_LABELS, type SalesRange } from "./analytics";
import type { IsoBounds } from "./sales-view";

const wholeMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalMoneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const wholePercentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  useGrouping: false,
});

const saleDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const monthYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function formatMoney(value: number): string {
  const normalizedValue = value === 0 ? 0 : value;
  const formatter = Number.isInteger(normalizedValue)
    ? wholeMoneyFormatter
    : decimalMoneyFormatter;

  return formatter.format(normalizedValue);
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${percentFormatter.format(value)}%`;
}

export function formatSaleDate(iso: string): string {
  return saleDateFormatter.format(new Date(iso));
}

// The KPI formatter above keeps one decimal; ledger ROI is intentionally whole-numbered.
export function formatRoi(value: number | null): string {
  return value === null ? "—" : `${wholePercentFormatter.format(value)}%`;
}

export function formatFee(value: number): string {
  return value === 0 ? "—" : `−${decimalMoneyFormatter.format(Math.abs(value))}`;
}

export function formatMonthYear(iso: string): string {
  return monthYearFormatter.format(new Date(iso));
}

export function formatRangeSubline(args: {
  range: SalesRange;
  bounds: IsoBounds;
  count: number;
  earliestSoldAt: string | null;
}): string {
  const { range, bounds, count, earliestSoldAt } = args;
  const saleCount = `${count} ${count === 1 ? "sale" : "sales"}`;

  if (range === "all") {
    return earliestSoldAt === null
      ? `All time · ${saleCount}`
      : `All time · ${saleCount} · since ${formatMonthYear(earliestSoldAt)}`;
  }

  const start = new Date(bounds.start);
  const inclusiveEnd = new Date(Date.parse(bounds.end) - ONE_DAY_MS);
  const sameYear = start.getUTCFullYear() === inclusiveEnd.getUTCFullYear();
  const sameDay =
    sameYear &&
    start.getUTCMonth() === inclusiveEnd.getUTCMonth() &&
    start.getUTCDate() === inclusiveEnd.getUTCDate();
  const span = sameDay
    ? saleDateFormatter.format(start)
    : sameYear
      ? `${monthDayFormatter.format(start)} – ${saleDateFormatter.format(inclusiveEnd)}`
      : `${saleDateFormatter.format(start)} – ${saleDateFormatter.format(inclusiveEnd)}`;

  return `${SALES_RANGE_LABELS[range]} · ${saleCount} · ${span}`;
}

// These compact labels coexist with PLATFORM_LABELS because pills and share captions
// do not have room for the full "Facebook Marketplace" name.
export const PLATFORM_SHORT_LABELS = {
  FB_MARKETPLACE: "Facebook",
  DEPOP: "Depop",
  EBAY: "eBay",
} satisfies Record<NonNullable<ItemDto["soldPlatform"]>, string>;

// Keep these as complete literals so Tailwind can discover every light/dark class.
export const PLATFORM_BAR_CLASSES = {
  FB_MARKETPLACE: "bg-violet-600 dark:bg-violet-400",
  DEPOP: "bg-sky-600 dark:bg-sky-400",
  EBAY: "bg-emerald-600 dark:bg-emerald-400",
} satisfies Record<NonNullable<ItemDto["soldPlatform"]>, string>;

export type DeltaTone = "up" | "down" | "muted";

export type ProfitDelta = {
  text: string;
  tone: DeltaTone;
};

const PREVIOUS_PERIOD_LABELS = {
  week: "last week",
  month: "last month",
  year: "last year",
} satisfies Record<Exclude<SalesRange, "all">, string>;

export function formatProfitDelta(args: {
  profit: number;
  previousProfit: number;
  range: SalesRange;
  earliestSoldAt: string | null;
}): ProfitDelta {
  const { profit, previousProfit, range, earliestSoldAt } = args;

  if (range === "all") {
    return {
      text:
        earliestSoldAt === null
          ? "No sales yet"
          : `Since ${formatMonthYear(earliestSoldAt)}`,
      tone: "muted",
    };
  }

  const previousPeriod = PREVIOUS_PERIOD_LABELS[range];

  if (previousProfit === 0) {
    return { text: `No profit ${previousPeriod}`, tone: "muted" };
  }

  const percentChange =
    ((profit - previousProfit) / Math.abs(previousProfit)) * 100;
  const tone = percentChange >= 0 ? "up" : "down";

  return {
    text: `${tone === "up" ? "▲" : "▼"} ${Math.abs(percentChange).toFixed(0)}% vs ${previousPeriod} (${formatMoney(previousProfit)})`,
    tone,
  };
}

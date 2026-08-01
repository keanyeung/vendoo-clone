import {
  DEFAULT_GRANULARITY,
  filterSales,
  platformSplit,
  previousBounds,
  rangeBounds,
  summarize,
  toSales,
  type Granularity,
  type PlatformSlice,
  type Sale,
  type SalesRange,
  type SalesSummary,
} from "./analytics";
import type { ItemDto } from "@/lib/item-dto";

// Every date is serialized before this view model crosses into Client Components.
export type IsoBounds = { start: string; end: string };

export type SalesView = {
  range: SalesRange;
  bounds: IsoBounds;
  previous: IsoBounds;
  sales: Sale[];
  summary: SalesSummary;
  previousSummary: SalesSummary;
  platforms: PlatformSlice[];
  defaultGranularity: Granularity;
  earliestSoldAt: string | null;
};

export function buildSalesView(
  items: ItemDto[],
  range: SalesRange,
  now: Date,
  earliest: Date | null,
): SalesView {
  const normalizedSales = toSales(items);
  const bounds = rangeBounds(range, now, earliest);
  const previous = previousBounds(bounds);
  const sales = filterSales(normalizedSales, bounds);
  const previousSales = filterSales(normalizedSales, previous);

  return {
    range,
    bounds: {
      start: bounds.start.toISOString(),
      end: bounds.end.toISOString(),
    },
    previous: {
      start: previous.start.toISOString(),
      end: previous.end.toISOString(),
    },
    sales,
    summary: summarize(sales),
    previousSummary: summarize(previousSales),
    platforms: platformSplit(sales),
    defaultGranularity: DEFAULT_GRANULARITY[range],
    earliestSoldAt: earliest?.toISOString() ?? null,
  };
}

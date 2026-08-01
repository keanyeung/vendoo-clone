"use client";

import { useMemo, useState } from "react";
import {
  bucketProfit,
  type Granularity,
  type ProfitBucket,
  type Sale,
  type SalesRange,
} from "@/lib/analytics";
import { toProfitBars, type ProfitBarTone } from "@/lib/profit-bars";
import { formatMoney } from "@/lib/sales-format";
import type { IsoBounds } from "@/lib/sales-view";

export type ProfitChartProps = {
  sales: Sale[];
  bounds: IsoBounds;
  range: SalesRange;
  defaultGranularity: Granularity;
};

const GRANULARITY_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
] as const satisfies readonly { value: Granularity; label: string }[];

const CHART_COPY = {
  day: {
    title: "Profit by day",
    subline: "Daily net profit across the selected week.",
  },
  week: {
    title: "Profit by week",
    subline: "Weekly net profit, weeks start Monday.",
  },
  month: {
    title: "Profit by month",
    subline: "Monthly net profit for the selected range.",
  },
} satisfies Record<Granularity, { title: string; subline: string }>;

// Keep these as complete literals so Tailwind emits every tone in both themes.
const BAR_TONE_CLASSES = {
  latest: "bg-green-600 dark:bg-green-400",
  positive: "bg-green-600/45 dark:bg-green-400/45",
  negative: "bg-red-600 dark:bg-red-400",
  empty: "",
} satisfies Record<ProfitBarTone, string>;

export default function ProfitChart({
  sales,
  bounds,
  range,
  defaultGranularity,
}: ProfitChartProps) {
  // The Server Component parent cannot own interactive state or rerun bucketProfit,
  // so this chart deliberately owns the granularity override from the design brief.
  const [granularityOverride, setGranularityOverride] =
    useState<Granularity | null>(null);
  const [seenRange, setSeenRange] = useState(range);

  // React's adjust-state-during-render pattern resets an override before the new
  // range commits, avoiding a stale-granularity render and an Effect round trip.
  if (range !== seenRange) {
    setSeenRange(range);
    setGranularityOverride(null);
  }

  const granularity = granularityOverride ?? defaultGranularity;
  const buckets = useMemo(
    () =>
      bucketProfit(
        sales,
        { start: new Date(bounds.start), end: new Date(bounds.end) },
        granularity,
      ),
    [sales, bounds.start, bounds.end, granularity],
  );
  const bars = useMemo(() => toProfitBars(buckets), [buckets]);
  const latestActiveIndex = buckets.reduce(
    (latest: number, bucket: ProfitBucket, index: number) =>
      bucket.count > 0 ? index : latest,
    -1,
  );
  const copy = CHART_COPY[granularity];

  return (
    <section className="rounded-xl border border-black/15 bg-black/[.02] p-5 dark:border-white/20 dark:bg-white/[.02]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold">{copy.title}</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {copy.subline}
          </p>
        </div>

        <div
          aria-label="Profit granularity"
          className="flex rounded-lg border border-black/15 p-[3px] dark:border-white/20"
        >
          {GRANULARITY_OPTIONS.map((option) => {
            const isSelected = option.value === granularity;

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setGranularityOverride(option.value)}
                className={`min-h-9 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isSelected
                    ? "bg-black/[.08] font-semibold dark:bg-white/[.12]"
                    : "bg-transparent text-black/60 hover:bg-black/[.04] dark:text-white/60 dark:hover:bg-white/[.06]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div aria-hidden="true" className="mt-8 flex h-[180px] items-end gap-2">
        {bars.map((bar, index) => (
          <div
            key={bar.key}
            title={bar.tip}
            className="flex h-full min-w-0 flex-1 flex-col text-center"
          >
            <div className="relative min-h-0 flex-1">
              {bar.tone !== "empty" && (
                <>
                  <span
                    className={`absolute inset-x-0 z-10 mb-1 hidden truncate text-[10px] leading-none min-[480px]:block ${
                      index === latestActiveIndex
                        ? "text-black dark:text-white"
                        : "text-black/60 dark:text-white/60"
                    }`}
                    style={{ bottom: `calc(${bar.heightPct}% + 0.25rem)` }}
                  >
                    {bar.valueLabel}
                  </span>
                  <div
                    className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-14 rounded-t ${BAR_TONE_CLASSES[bar.tone]}`}
                    style={{ height: `${bar.heightPct}%` }}
                  />
                </>
              )}
            </div>
            <p className="mt-2 truncate text-xs text-black/60 dark:text-white/60">
              {bar.label}
            </p>
          </div>
        ))}
      </div>

      <details className="mt-5 border-t border-black/10 pt-4 dark:border-white/15">
        <summary className="cursor-pointer text-sm font-medium">
          View as table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-md text-left text-sm">
            <thead className="border-b border-black/15 text-black/60 dark:border-white/20 dark:text-white/60">
              <tr>
                <th scope="col" className="px-2 py-2 font-medium">
                  Period
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Items
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((bucket: ProfitBucket) => (
                <tr
                  key={bucket.key}
                  className="border-b border-black/10 last:border-b-0 dark:border-white/15"
                >
                  <th scope="row" className="px-2 py-2 font-normal">
                    {bucket.tipLabel}
                  </th>
                  <td className="px-2 py-2 text-right">{bucket.count}</td>
                  <td className="px-2 py-2 text-right">
                    {formatMoney(bucket.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

import Link from "next/link";
import type { MonthlyBucket } from "@/lib/analytics";
import type { DashboardSummary } from "@/lib/dashboard";

export type DashboardAnalyticsProps = {
  summary: DashboardSummary;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// UTC, matching how lib/analytics.ts builds the keys, so a bucket never renders as the
// neighbouring month on a server west of Greenwich.
const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

// bucket.label carries the year ("Jul 2026"), which does not fit under a 6-bar chart; the key
// is the only other place the month survives, so the short name is rebuilt from it.
function shortMonth(key: string): string {
  const [year, month] = key.split("-");
  return shortMonthFormatter.format(
    new Date(Date.UTC(Number(year), Number(month) - 1, 1)),
  );
}

// Intentionally server-rendered: bar heights are inline percentages, so the chart needs no client JavaScript.
export default function DashboardAnalytics({
  summary,
}: DashboardAnalyticsProps) {
  const { monthly } = summary;
  // The last bucket stands in for "current month". Reading the clock here would make the
  // component impure (react-hooks/purity), and the newest month with sales is what the
  // reference highlights anyway — an all-quiet current month has no bar to highlight.
  const currentKey = monthly.at(-1)?.key;
  const maxAbs =
    monthly.length === 0
      ? 0
      : Math.max(
          ...monthly.map((bucket: MonthlyBucket) => Math.abs(bucket.profit)),
        );

  const stats = [
    {
      label: "Best month",
      value:
        summary.bestMonth === null
          ? "—"
          : `${shortMonth(summary.bestMonth.key)} · ${currencyFormatter.format(summary.bestMonth.profit)}`,
    },
    {
      label: "Avg / item",
      value:
        summary.avgProfitPerItem === null
          ? "—"
          : currencyFormatter.format(summary.avgProfitPerItem),
    },
    {
      label: "Top category",
      value: summary.topCategory ?? "—",
    },
    {
      label: "Sell-through",
      value:
        summary.sellThroughPct === null ? "—" : `${summary.sellThroughPct}%`,
    },
  ];

  return (
    <section className="rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4.5 dark:border-white/15">
        <div>
          <h2 className="text-base font-semibold">Analytics</h2>
          <p className="mt-1 text-[13px] text-black/60 dark:text-white/60">
            Profit, last 6 months
          </p>
        </div>
        <Link
          href="/analytics"
          className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-black/15 px-3 text-[13px] font-medium text-black/60 dark:border-white/20 dark:text-white/60"
        >
          Open →
        </Link>
      </div>

      {monthly.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-black/60 dark:text-white/60">
          No sales recorded yet
        </p>
      ) : (
        <div className="p-5">
          <div aria-hidden="true" className="flex h-26 items-end gap-2">
            {monthly.map((bucket: MonthlyBucket) => {
              // Preserve zero months without dividing by zero when the series is flat.
              const height =
                maxAbs === 0
                  ? "2px"
                  : `${Math.max((Math.abs(bucket.profit) / maxAbs) * 100, 3)}%`;

              return (
                <div
                  key={bucket.key}
                  className="flex h-full flex-1 flex-col justify-end gap-1.5"
                >
                  {/* Capped and centred so a lone bucket reads as a bar rather than a
                      slab of colour; at six buckets the column is narrower than the cap,
                      so the full-width look is unchanged. */}
                  <div
                    className={`mx-auto w-full max-w-16 rounded-t-sm ${
                      bucket.key === currentKey
                        ? "bg-green-600/70 dark:bg-green-400/70"
                        : "bg-green-600/30 dark:bg-green-400/35"
                    }`}
                    style={{ height }}
                  />
                  <span className="text-center text-[11px] text-black/60 dark:text-white/60">
                    {shortMonth(bucket.key)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* The bars are aria-hidden, so this sentence is the only form of the series a screen
              reader gets; it uses the full "Mon YYYY" label because it has no width limit. */}
          <p className="sr-only">
            {`Profit by month: ${monthly
              .map(
                (bucket: MonthlyBucket) =>
                  `${bucket.label} ${currencyFormatter.format(bucket.profit)}`,
              )
              .join(", ")}`}
          </p>

          <dl className="mt-4.5 grid grid-cols-2 gap-3.5">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] font-semibold uppercase tracking-[.07em] text-black/60 dark:text-white/60">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-[15px] font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

import type { DashboardSummary } from "@/lib/dashboard";

export type DashboardMetricsProps = {
  summary: DashboardSummary;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// Lifted out of JSX: four mutually exclusive outcomes read as a chain of ternaries otherwise.
function formatDaysToSellTrend(
  current: number | null,
  previous: number | null,
): string {
  if (current === null || previous === null) {
    return "not enough sales yet";
  }

  if (current < previous) {
    return `down from ${previous} last month`;
  }

  if (current > previous) {
    return `up from ${previous} last month`;
  }

  return "same as last month";
}

type MetricCardProps = {
  label: string;
  value: string;
  sub: string;
  valueClassName?: string;
};

// A description list per card keeps each label the accessible name of its own value;
// one list around all four would imply the cards are terms of a single group.
function MetricCard({ label, value, sub, valueClassName }: MetricCardProps) {
  return (
    <dl className="rounded-xl border border-black/15 bg-black/[.02] px-4.5 py-4 dark:border-white/20 dark:bg-white/[.02]">
      <dt className="text-[11px] font-semibold uppercase tracking-[.07em] text-black/60 dark:text-white/60">
        {label}
      </dt>
      <dd
        className={`mt-2.5 text-[26px] font-semibold tracking-tight${
          valueClassName === undefined ? "" : ` ${valueClassName}`
        }`}
      >
        {value}
      </dd>
      <dd className="mt-1.5 text-xs text-black/60 dark:text-white/60">{sub}</dd>
    </dl>
  );
}

// Intentionally server-rendered: these four numbers are fixed at request time.
export default function DashboardMetrics({ summary }: DashboardMetricsProps) {
  return (
    <section className="mt-7 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Revenue this month"
        value={currencyFormatter.format(summary.revenueThisMonth)}
        sub={`${summary.salesThisMonth} ${
          summary.salesThisMonth === 1 ? "sale" : "sales"
        } · ${currencyFormatter.format(summary.revenueYtd)} YTD`}
      />

      <MetricCard
        label="Profit this month"
        value={currencyFormatter.format(summary.profitThisMonth)}
        valueClassName={
          summary.profitThisMonth >= 0
            ? "text-green-700 dark:text-green-400"
            : "text-red-700 dark:text-red-400"
        }
        sub={
          summary.marginThisMonthPct === null
            ? "no revenue yet"
            : `${summary.marginThisMonthPct}% margin`
        }
      />

      <MetricCard
        label="Active listings"
        value={String(summary.activeListings)}
        sub={`${currencyFormatter.format(summary.inventoryValue)} inventory value`}
      />

      <MetricCard
        label="Avg days to sell"
        value={
          summary.avgDaysToSell === null ? "—" : String(summary.avgDaysToSell)
        }
        sub={formatDaysToSellTrend(
          summary.avgDaysToSell,
          summary.avgDaysToSellPrevMonth,
        )}
      />
    </section>
  );
}

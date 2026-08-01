import type {
  PlatformSlice,
  SalesRange,
  SalesSummary,
} from "@/lib/analytics";
import {
  formatMoney,
  formatPercent,
  formatProfitDelta,
  type DeltaTone,
} from "@/lib/sales-format";
import PlatformShareBar from "./PlatformShareBar";

export type KpiCardsProps = {
  summary: SalesSummary;
  previousSummary: SalesSummary;
  platforms: PlatformSlice[];
  range: SalesRange;
  earliestSoldAt: string | null;
};

type MetricCardProps = {
  label: string;
  value: string;
  sub: string;
  valueClassName?: string;
  subClassName?: string;
};

// A description list per card keeps each label the accessible name of its own value;
// one list around all four would imply the cards are terms of a single group.
function MetricCard({
  label,
  value,
  sub,
  valueClassName,
  subClassName,
}: MetricCardProps) {
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
      <dd
        className={`mt-1.5 text-xs${
          subClassName === undefined
            ? " text-black/60 dark:text-white/60"
            : ` ${subClassName}`
        }`}
      >
        {sub}
      </dd>
    </dl>
  );
}

const DELTA_TONE_CLASSES = {
  up: "text-green-700 dark:text-green-400",
  down: "text-red-700 dark:text-red-400",
  muted: "text-black/60 dark:text-white/60",
} satisfies Record<DeltaTone, string>;

export default function KpiCards({
  summary,
  previousSummary,
  platforms,
  range,
  earliestSoldAt,
}: KpiCardsProps) {
  const profitDelta = formatProfitDelta({
    profit: summary.profit,
    previousProfit: previousSummary.profit,
    range,
    earliestSoldAt,
  });
  const averageProfit =
    summary.avgProfit === null ? "—" : formatMoney(summary.avgProfit);
  const averageDays =
    summary.avgDaysToSell === null ? "—" : String(summary.avgDaysToSell);
  const dayLabel = summary.avgDaysToSell === 1 ? "day" : "days";

  return (
    <section
      aria-label="Sales metrics"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <MetricCard
        label="Net profit"
        sub={profitDelta.text}
        subClassName={DELTA_TONE_CLASSES[profitDelta.tone]}
        value={formatMoney(summary.profit)}
        valueClassName={
          summary.profit >= 0
            ? "text-green-700 dark:text-green-400"
            : "text-red-700 dark:text-red-400"
        }
      />

      <MetricCard
        label="Revenue"
        sub={`− ${formatMoney(summary.cost)} cost · − ${formatMoney(summary.fees)} fees`}
        value={formatMoney(summary.revenue)}
      />

      <MetricCard
        label="Items sold"
        sub={`${averageProfit} avg profit · ${averageDays} avg ${dayLabel} to sell`}
        value={String(summary.count)}
      />

      <dl className="grid grid-cols-2 gap-x-4 rounded-xl border border-black/15 bg-black/[.02] px-4.5 py-4 dark:border-white/20 dark:bg-white/[.02]">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[.07em] text-black/60 dark:text-white/60">
            Margin
          </dt>
          <dd className="mt-2.5 text-[22px] font-semibold tracking-tight">
            {formatPercent(summary.marginPct)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[.07em] text-black/60 dark:text-white/60">
            ROI
          </dt>
          <dd className="mt-2.5 text-[22px] font-semibold tracking-tight">
            {formatPercent(summary.roiPct)}
          </dd>
        </div>
        <div className="col-span-2 mt-3">
          <dt className="sr-only">Profit by platform</dt>
          <dd>
            <PlatformShareBar platforms={platforms} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import AnalyticsRangeToggle from "@/components/AnalyticsRangeToggle";
import ProfitChart from "@/components/ProfitChart";
import {
  computeAnalytics,
  isAnalyticsRange,
  type AnalyticsRange,
} from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { toItemDtos } from "@/lib/item-dto";

// This database-backed page must render fresh on every request, not with stale build-time data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function firstSearchParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

export default async function AnalyticsPage(
  props: PageProps<"/analytics">,
) {
  const searchParams = await props.searchParams;
  const rangeParam = firstSearchParam(searchParams.range);
  const range: AnalyticsRange = isAnalyticsRange(rangeParam)
    ? rangeParam
    : "all";

  const items = await prisma.item.findMany({
    where: { status: "SOLD" },
  });
  const dtos = toItemDtos(items);
  const summary = computeAnalytics(dtos, range, new Date());
  const allTimeSalesCount = dtos.length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {allTimeSalesCount}{" "}
          {allTimeSalesCount === 1 ? "sale" : "sales"} all time
        </p>
      </div>

      <AnalyticsRangeToggle range={range} />

      {dtos.length === 0 ? (
        <section className="mt-8 rounded-xl border border-black/15 px-6 py-12 text-center dark:border-white/20">
          <h2 className="text-lg font-semibold">No sales recorded yet</h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Once you mark items as sold, your profit and sales metrics appear
            here.
          </p>
          <Link
            href="/listings"
            className="mt-5 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Go to listings
          </Link>
        </section>
      ) : summary.itemsSold === 0 ? (
        <section className="mt-8 rounded-xl border border-black/15 px-6 py-12 text-center dark:border-white/20">
          <h2 className="text-lg font-semibold">No sales in this period.</h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Switch to All time to see your complete sales history.
          </p>
        </section>
      ) : (
        <section className="mt-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-black/15 p-4 dark:border-white/20">
              <p className="text-xs font-medium uppercase tracking-wide text-black/60 dark:text-white/60">
                Total profit
              </p>
              <p
                className={`mt-2 text-2xl font-semibold ${
                  summary.totalProfit >= 0
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                {currencyFormatter.format(summary.totalProfit)}
              </p>
              {range !== "all" && (
                <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                  {currencyFormatter.format(summary.allTimeProfit)} all time
                </p>
              )}
            </div>

            <div className="rounded-xl border border-black/15 p-4 dark:border-white/20">
              <p className="text-xs font-medium uppercase tracking-wide text-black/60 dark:text-white/60">
                Revenue
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {currencyFormatter.format(summary.totalRevenue)}
              </p>
              <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                − {currencyFormatter.format(summary.totalCogs)} cost · −{" "}
                {currencyFormatter.format(summary.totalFees)} fees
              </p>
            </div>

            <div className="rounded-xl border border-black/15 p-4 dark:border-white/20">
              <p className="text-xs font-medium uppercase tracking-wide text-black/60 dark:text-white/60">
                Avg profit / item
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {summary.avgProfitPerItem === null
                  ? "—"
                  : currencyFormatter.format(summary.avgProfitPerItem)}
              </p>
              <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                across {summary.itemsSold}{" "}
                {summary.itemsSold === 1 ? "item" : "items"}
              </p>
            </div>

            {/* These are ratios of totals, computed in lib/analytics. */}
            <div className="rounded-xl border border-black/15 p-4 dark:border-white/20">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-black/60 dark:text-white/60">
                  Overall margin
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatPercentage(summary.overallMarginPct)}
                </p>
                {summary.overallMarginPct === null && (
                  <p className="text-xs text-black/60 dark:text-white/60">
                    no revenue
                  </p>
                )}
              </div>
              <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/15">
                <p className="text-xs font-medium uppercase tracking-wide text-black/60 dark:text-white/60">
                  Overall ROI
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatPercentage(summary.overallRoiPct)}
                </p>
                {summary.overallRoiPct === null && (
                  <p className="text-xs text-black/60 dark:text-white/60">
                    no cost basis
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="mt-3 text-sm text-black/60 dark:text-white/60">
            Profit is net of purchase cost and platform fees.
          </p>

          <ProfitChart monthly={summary.monthly} />
        </section>
      )}
    </main>
  );
}

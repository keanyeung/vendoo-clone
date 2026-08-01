import Link from "next/link";
import type { Metadata } from "next";
import KpiCards from "@/components/analytics/KpiCards";
import ProfitChart from "@/components/analytics/ProfitChart";
import RangeToggle from "@/components/analytics/RangeToggle";
import SoldItemsTable from "@/components/analytics/SoldItemsTable";
import { isSalesRange, type SalesRange } from "@/lib/analytics";
import { loadSalesView } from "@/lib/queries/sales";
import { formatRangeSubline } from "@/lib/sales-format";

// This database-backed page must render fresh on every request, not with stale build-time data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
};

function firstSearchParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AnalyticsPage(
  props: PageProps<"/analytics">,
) {
  // Capture one request-time value so the header, range bounds, and every child agree.
  const now = new Date();
  const searchParams = await props.searchParams;
  const rangeParam = firstSearchParam(searchParams.range);
  const range: SalesRange = isSalesRange(rangeParam) ? rangeParam : "month";
  const view = await loadSalesView(range, now);
  const subline = formatRangeSubline({
    range: view.range,
    bounds: view.bounds,
    count: view.summary.count,
    earliestSoldAt: view.earliestSoldAt,
  });

  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-6 pt-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1.5 text-sm text-black/60 dark:text-white/60">
            {subline}
          </p>
        </div>
        <RangeToggle range={view.range} />
      </div>

      {view.earliestSoldAt === null ? (
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
      ) : (
        <>
          <div className="mt-6">
            <KpiCards
              summary={view.summary}
              previousSummary={view.previousSummary}
              platforms={view.platforms}
              range={view.range}
              earliestSoldAt={view.earliestSoldAt}
            />
          </div>
          <div className="mt-3">
            <ProfitChart
              sales={view.sales}
              bounds={view.bounds}
              range={view.range}
              defaultGranularity={view.defaultGranularity}
            />
          </div>
          <div className="mt-3">
            <SoldItemsTable sales={view.sales} range={view.range} />
          </div>
        </>
      )}
    </main>
  );
}

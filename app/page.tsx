import DashboardAnalytics from "@/components/DashboardAnalytics";
import DashboardAttention from "@/components/DashboardAttention";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import DashboardListings from "@/components/DashboardListings";
import DashboardMetrics from "@/components/DashboardMetrics";
import type { AttentionItem } from "@/lib/dashboard";
import { computeDashboard } from "@/lib/dashboard";
import { toItemDtos } from "@/lib/item-dto";
import { prisma } from "@/lib/db";

// This database-backed page must render fresh on every request, not with stale build-time data.
export const dynamic = "force-dynamic";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Deliberately shorter than AttentionItem.title: the greeting summarises, the card below explains.
function attentionPhrase(entry: AttentionItem): string {
  const { count } = entry;

  switch (entry.kind) {
    case "stale_draft":
      return `${count} ${count === 1 ? "draft" : "drafts"} waiting`;
    case "aging_listing":
      return `${count} ${count === 1 ? "listing" : "listings"} going stale`;
    case "missing_fees":
      return `${count} ${count === 1 ? "sale" : "sales"} missing fees`;
  }
}

// Only the first two entries: a third clause turns the subline into a wall of text at the top of the page.
function buildSubline(attention: AttentionItem[]): string {
  if (attention.length === 0) {
    return "Everything is up to date.";
  }

  return `${attention.slice(0, 2).map(attentionPhrase).join(" and ")}.`;
}

export default async function Home() {
  // Capture one request-time value so every block on the page agrees. No react-hooks/purity
  // disable here (unlike app/listings/page.tsx): the rule flags `Date.now()`, not `new Date()`,
  // and an unused directive is itself a lint warning.
  const now = new Date();

  const items = await prisma.item.findMany();
  const summary = computeDashboard(toItemDtos(items), now);

  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-6 pt-8 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">
            {greetingForHour(now.getHours())}
          </h1>
          <p className="mt-1.5 text-sm text-black/60 dark:text-white/60">
            {buildSubline(summary.attention)}
          </p>
        </div>
        <span className="text-[13px] text-black/60 dark:text-white/60">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      {summary.totalItems === 0 ? (
        // Four zeroed metric cards would be noise, not information, before the first item exists.
        <DashboardEmptyState />
      ) : (
        <>
          <DashboardMetrics summary={summary} />

          <div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <DashboardListings summary={summary} now={now.getTime()} />
            <div className="flex flex-col gap-3">
              <DashboardAnalytics summary={summary} />
              <DashboardAttention summary={summary} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

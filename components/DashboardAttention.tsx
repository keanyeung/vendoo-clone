import Link from "next/link";
import type { AttentionItem, DashboardSummary } from "@/lib/dashboard";

export type DashboardAttentionProps = {
  summary: DashboardSummary;
};

// Intentionally server-rendered: every row is fixed at request time and the actions are plain links.
export default function DashboardAttention({
  summary,
}: DashboardAttentionProps) {
  const { attention } = summary;
  // The header counts affected items, not rows: "3 drafts" plus "2 listings" is 5 things to deal with.
  const total = attention.reduce(
    (sum: number, entry: AttentionItem) => sum + entry.count,
    0,
  );

  return (
    <section className="rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]">
      <div className="border-b border-black/10 px-5 pt-4.5 pb-3.5 dark:border-white/15">
        <h2 className="text-base font-semibold">Needs attention</h2>
        <p className="mt-1 text-[13px] text-black/60 dark:text-white/60">
          {attention.length === 0
            ? "Nothing to deal with"
            : `${total} ${total === 1 ? "item" : "items"} to deal with`}
        </p>
      </div>

      {attention.length === 0 ? (
        <p className="px-5 py-3.5 text-sm text-black/60 dark:text-white/60">
          Nothing needs attention right now.
        </p>
      ) : (
        // kind is unique per entry by construction — computeDashboard emits at most one row per
        // kind — so it keys the list without the reorder hazards of an array index.
        attention.map((entry: AttentionItem) => (
          <div
            key={entry.kind}
            className="flex items-center justify-between gap-3 border-b border-black/[.06] px-5 py-3.5 last:border-b-0 dark:border-white/10"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{entry.title}</p>
              <p className="mt-0.5 text-xs text-black/60 dark:text-white/60">
                {entry.detail}
              </p>
            </div>
            {/* "Review" / "Price" / "Fix" are meaningless in a screen reader's link list, where the
                row title beside them is not read out; the label restores that missing context. */}
            <Link
              href={entry.href}
              aria-label={`${entry.action}: ${entry.title}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-black/15 px-2.5 text-xs font-semibold dark:border-white/20"
            >
              {entry.action}
            </Link>
          </div>
        ))
      )}
    </section>
  );
}

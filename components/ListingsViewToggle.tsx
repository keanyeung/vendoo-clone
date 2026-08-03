import Link from "next/link";
import type { AttentionFilterKey } from "@/lib/listing-filters";
import { parseSort, serializeSort } from "@/lib/listing-sort";
import type { PostingPlatform } from "@/lib/postings";

type ListingsViewToggleProps = {
  view: "grid" | "table";
  status: string;
  q: string;
  attention: AttentionFilterKey | "";
  notOn: PostingPlatform | "";
  sort: string;
};

export default function ListingsViewToggle({
  view,
  status,
  q,
  attention,
  notOn,
  sort,
}: ListingsViewToggleProps) {
  const baseParams = new URLSearchParams();
  if (status) baseParams.set("status", status);
  if (q) baseParams.set("q", q);
  if (attention) baseParams.set("attention", attention);
  if (notOn) baseParams.set("notOn", notOn);
  baseParams.set("sort", serializeSort(parseSort(sort)));

  const cardsQuery = baseParams.toString();
  const tableParams = new URLSearchParams(baseParams);
  tableParams.set("view", "table");
  const inactiveClassName =
    "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white";
  const activeClassName = "bg-foreground text-background";

  return (
    <div className="inline-flex rounded-md border border-black/15 p-1 dark:border-white/20">
      <Link
        href={cardsQuery ? `/listings?${cardsQuery}` : "/listings"}
        aria-label="View listings as cards"
        aria-current={view === "grid" ? "page" : undefined}
        className={`flex min-h-10 items-center rounded px-3 text-sm font-medium ${
          view === "grid" ? activeClassName : inactiveClassName
        }`}
      >
        Cards
      </Link>
      <Link
        href={`/listings?${tableParams.toString()}`}
        aria-label="View listings as a table"
        aria-current={view === "table" ? "page" : undefined}
        className={`flex min-h-10 items-center rounded px-3 text-sm font-medium ${
          view === "table" ? activeClassName : inactiveClassName
        }`}
      >
        Table
      </Link>
    </div>
  );
}

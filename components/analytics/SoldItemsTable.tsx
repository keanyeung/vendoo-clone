"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import {
  SALES_RANGE_LABELS,
  summarize,
  type Sale,
  type SalesRange,
} from "@/lib/analytics";
import { buildSoldItemsCsv, soldItemsCsvFilename } from "@/lib/csv";
import {
  PLATFORM_SHORT_LABELS,
  formatFee,
  formatMoney,
  formatRoi,
  formatSaleDate,
} from "@/lib/sales-format";
import {
  DEFAULT_SOLD_ITEMS_SORT,
  sortSoldItems,
  type SoldItemsSort,
  type SoldItemsSortField,
} from "@/lib/sold-items-sort";

export type SoldItemsTableProps = {
  sales: Sale[];
  range: SalesRange;
};

type Platform = NonNullable<Sale["platform"]>;
type PlatformFilter = "all" | Platform;

type RowCells = {
  sold: string;
  platform: string;
  soldPrice: string;
  paid: string;
  fees: string;
  profit: string;
  roi: string;
  meta: string;
};

const PLATFORM_OPTIONS = (Object.keys(PLATFORM_SHORT_LABELS) as Platform[])
  .reverse()
  .map((value) => ({ value, label: PLATFORM_SHORT_LABELS[value] }));

// Keep these as complete literals so Tailwind discovers both profit tones.
const PROFIT_TONE_CLASSES = {
  positive: "text-green-700 dark:text-green-400",
  negative: "text-red-700 dark:text-red-400",
} as const;

function profitTone(value: number): (typeof PROFIT_TONE_CLASSES)[keyof typeof PROFIT_TONE_CLASSES] {
  return value >= 0
    ? PROFIT_TONE_CLASSES.positive
    : PROFIT_TONE_CLASSES.negative;
}

function toRowCells(sale: Sale): RowCells {
  return {
    sold: formatSaleDate(sale.soldAt),
    platform:
      sale.platform === null ? "—" : PLATFORM_SHORT_LABELS[sale.platform],
    soldPrice: formatMoney(sale.soldPrice),
    paid: formatMoney(sale.purchasePrice),
    fees: formatFee(sale.fees),
    profit: formatMoney(sale.profit),
    roi: formatRoi(sale.roiPct),
    meta: [sale.category, sale.size].filter(Boolean).join(" · "),
  };
}

function ItemIdentity({ sale, meta }: { sale: Sale; meta: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {sale.photo ? (
        <>
          {/* alt="" on purpose: the title beside it already names the row, so describing the
              photo again would only add duplicate noise for screen readers. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sale.photo}
            alt=""
            className="size-[34px] shrink-0 rounded-md object-cover"
          />
        </>
      ) : (
        <div className="size-[34px] shrink-0 rounded-md bg-black/[.04] dark:bg-white/[.06]" />
      )}

      <div className="min-w-0">
        <Link
          href={`/listings/${sale.id}`}
          className="block truncate font-medium hover:underline"
        >
          {sale.title}
        </Link>
        {meta && (
          <p className="mt-0.5 truncate text-[11.5px] text-black/60 dark:text-white/60">
            {meta}
          </p>
        )}
      </div>
    </div>
  );
}

function PlatformValue({ value }: { value: string }) {
  return value === "—" ? (
    <>{value}</>
  ) : (
    <span className="inline-block rounded-full bg-black/[.06] px-2.5 py-1 text-xs dark:bg-white/[.08]">
      {value}
    </span>
  );
}

type SortableHeaderProps = {
  field: SoldItemsSortField;
  label: string;
  numeric?: boolean;
  sort: SoldItemsSort;
  onSort: (field: SoldItemsSortField) => void;
};

function SortableHeader({
  field,
  label,
  numeric = false,
  sort,
  onSort,
}: SortableHeaderProps) {
  const isActive = sort.field === field;

  return (
    <th
      scope="col"
      aria-sort={
        isActive ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
      className="p-0 font-medium"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`flex w-full items-center gap-1 px-3 py-3 transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.04] ${
          numeric ? "justify-end text-right" : "justify-start text-left"
        } ${
          isActive
            ? "font-semibold text-black dark:text-white"
            : "font-medium text-black/60 dark:text-white/60"
        }`}
      >
        <span>{label}</span>
        {isActive && <span aria-hidden="true">{sort.dir === "desc" ? "⌄" : "⌃"}</span>}
      </button>
    </th>
  );
}

export default function SoldItemsTable({
  sales,
  range,
}: SoldItemsTableProps) {
  const router = useRouter();
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [sort, setSort] = useState<SoldItemsSort>(DEFAULT_SOLD_ITEMS_SORT);
  const [showAll, setShowAll] = useState(false);
  const [seenRange, setSeenRange] = useState(range);

  // Match the chart's adjust-state-during-render reset so a range change commits collapsed.
  if (range !== seenRange) {
    setSeenRange(range);
    setShowAll(false);
  }

  const filtered =
    platform === "all"
      ? sales
      : sales.filter((sale) => sale.platform === platform);
  const sorted = sortSoldItems(filtered, sort);
  const visible = showAll ? sorted : sorted.slice(0, 8);
  const totals = summarize(sorted);
  const missingFeeCount = sorted.filter((sale) => sale.fees === 0).length;
  const visibleRows = visible.map((sale) => ({
    sale,
    cells: toRowCells(sale),
  }));

  function handleSort(field: SoldItemsSortField) {
    setSort((current) => {
      if (current.field === field) {
        return { field, dir: current.dir === "asc" ? "desc" : "asc" };
      }

      return { field, dir: field === "title" ? "asc" : "desc" };
    });
  }

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, sale: Sale) {
    if (event.target instanceof HTMLElement && event.target.closest("a")) return;
    router.push(`/listings/${sale.id}`);
  }

  function handleExport() {
    const csv = buildSoldItemsCsv(sorted);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = soldItemsCsvFilename(range, new Date());
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <h2 className="text-[17px] font-semibold">Sold items</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Every sale behind the numbers above · {SALES_RANGE_LABELS[range].toLowerCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium">
            <span className="sr-only">Platform</span>
            <select
              value={platform}
              onChange={(event) =>
                setPlatform(event.target.value as PlatformFilter)
              }
              className="min-h-10 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20 dark:bg-black"
            >
              <option value="all">All platforms</option>
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleExport}
            className="min-h-10 rounded-md border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            Export CSV
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="border-t border-black/10 px-5 py-12 text-center dark:border-white/15">
          <p className="font-medium">No sales in this range yet.</p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Mark an item sold from Listings and it shows up here.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden border-t border-black/10 md:block dark:border-white/15">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-black/15 dark:border-white/20">
                <tr>
                  <SortableHeader
                    field="title"
                    label="Item"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    field="soldAt"
                    label="Sold"
                    sort={sort}
                    onSort={handleSort}
                  />
                  <th scope="col" className="px-3 py-3 font-medium text-black/60 dark:text-white/60">
                    Platform
                  </th>
                  <SortableHeader
                    field="soldPrice"
                    label="Sold price"
                    numeric
                    sort={sort}
                    onSort={handleSort}
                  />
                  <th scope="col" className="px-3 py-3 text-right font-medium text-black/60 dark:text-white/60">
                    Paid
                  </th>
                  <th scope="col" className="px-3 py-3 text-right font-medium text-black/60 dark:text-white/60">
                    Fees
                  </th>
                  <SortableHeader
                    field="profit"
                    label="Profit"
                    numeric
                    sort={sort}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    field="roi"
                    label="ROI"
                    numeric
                    sort={sort}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ sale, cells }) => (
                  <tr
                    key={sale.id}
                    onClick={(event) => handleRowClick(event, sale)}
                    className="cursor-pointer border-b border-black/10 hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.04]"
                  >
                    <td className="px-3 py-3">
                      <ItemIdentity sale={sale} meta={cells.meta} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{cells.sold}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <PlatformValue value={cells.platform} />
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {cells.soldPrice}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap text-black/60 dark:text-white/60">
                      {cells.paid}
                    </td>
                    <td
                      className={`px-3 py-3 text-right whitespace-nowrap ${
                        sale.fees === 0
                          ? "text-black/40 dark:text-white/30"
                          : "text-black/60 dark:text-white/60"
                      }`}
                    >
                      {cells.fees}
                    </td>
                    <td className={`px-3 py-3 text-right font-semibold whitespace-nowrap ${profitTone(sale.profit)}`}>
                      {cells.profit}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {cells.roi}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-black/15 bg-black/[.03] font-semibold dark:border-white/20 dark:bg-white/[.03]">
                <tr>
                  <td className="px-3 py-3">{totals.count} items</td>
                  <td />
                  <td />
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {formatMoney(totals.revenue)}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {formatMoney(totals.cost)}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {formatMoney(totals.fees)}
                  </td>
                  <td className={`px-3 py-3 text-right whitespace-nowrap ${profitTone(totals.profit)}`}>
                    {formatMoney(totals.profit)}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {formatRoi(totals.roiPct)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="space-y-3 border-t border-black/10 p-4 md:hidden dark:border-white/15">
            {visibleRows.map(({ sale, cells }) => (
              <article
                key={sale.id}
                className="rounded-lg border border-black/10 bg-black/[.02] p-4 dark:border-white/15 dark:bg-white/[.02]"
              >
                <ItemIdentity sale={sale} meta={cells.meta} />
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-black/60 dark:text-white/60">Sold</dt>
                  <dd className="text-right">{cells.sold}</dd>
                  <dt className="text-black/60 dark:text-white/60">Platform</dt>
                  <dd className="text-right"><PlatformValue value={cells.platform} /></dd>
                  <dt className="text-black/60 dark:text-white/60">Sold price</dt>
                  <dd className="text-right">{cells.soldPrice}</dd>
                  <dt className="text-black/60 dark:text-white/60">Paid</dt>
                  <dd className="text-right text-black/60 dark:text-white/60">{cells.paid}</dd>
                  <dt className="text-black/60 dark:text-white/60">Fees</dt>
                  <dd
                    className={`text-right ${
                      sale.fees === 0
                        ? "text-black/40 dark:text-white/30"
                        : "text-black/60 dark:text-white/60"
                    }`}
                  >
                    {cells.fees}
                  </dd>
                  <dt className="text-black/60 dark:text-white/60">Profit</dt>
                  <dd className={`text-right font-semibold ${profitTone(sale.profit)}`}>
                    {cells.profit}
                  </dd>
                  <dt className="text-black/60 dark:text-white/60">ROI</dt>
                  <dd className="text-right">{cells.roi}</dd>
                </dl>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-5 py-4 text-xs text-black/60 dark:border-white/15 dark:text-white/60">
            <p>
              Totals match the cards above. Sales with no recorded fees count as $0
              {missingFeeCount > 0 && (
                <>
                  {" — "}
                  <Link
                    href="/listings?status=SOLD"
                    className="font-medium text-black underline underline-offset-2 dark:text-white"
                  >
                    {missingFeeCount === 1
                      ? "1 item needs fees"
                      : `${missingFeeCount} items need fees`}
                  </Link>
                </>
              )}
            </p>

            {sorted.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="font-medium text-black hover:underline dark:text-white"
              >
                {showAll ? "Show top 8" : `Show all ${sorted.length}`}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

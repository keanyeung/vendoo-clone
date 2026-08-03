"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ChangeEvent } from "react";
import ChannelIndicator from "@/components/listings/ChannelIndicator";
import ListingRowActions from "@/components/listings/ListingRowActions";
import { useListingsSelection } from "@/components/listings/ListingsSelectionProvider";
import type { ListingRowDto } from "@/lib/item-dto";
import { carryListingContext } from "@/lib/listing-context";
import {
  daysListed,
  parseSort,
  serializeSort,
  type SortField,
} from "@/lib/listing-sort";
import { STATUS_STYLES } from "@/lib/status-style";

type ListingsTableProps = {
  items: ListingRowDto[];
  now: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const defaultSortDirections: Record<SortField, "asc" | "desc"> = {
  title: "asc",
  status: "asc",
  price: "desc",
  sold: "desc",
  added: "desc",
  days: "desc",
  channels: "desc",
  soldDate: "desc",
};

export default function ListingsTable({ items, now }: ListingsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = parseSort(searchParams.get("sort"));
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const mobileHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  const rangeAnchorRef = useRef<string | null>(null);
  const { selectedIds, toggle, selectRange, selectAll } =
    useListingsSelection();
  const pageIds = items.map((item) => item.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPage === pageIds.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;

  useEffect(() => {
    for (const checkbox of [
      headerCheckboxRef.current,
      mobileHeaderCheckboxRef.current,
    ]) {
      if (checkbox !== null) checkbox.indeterminate = someOnPageSelected;
    }
  }, [someOnPageSelected]);

  function onRowSelection(
    event: ChangeEvent<HTMLInputElement>,
    id: string,
  ): void {
    const anchorId = rangeAnchorRef.current;
    const isShiftClick =
      event.nativeEvent instanceof MouseEvent && event.nativeEvent.shiftKey;

    if (isShiftClick && anchorId !== null && pageIds.includes(anchorId)) {
      selectRange(pageIds, anchorId, id, event.currentTarget.checked);
    } else {
      toggle(id);
    }
    rangeAnchorRef.current = id;
  }

  function onSort(field: SortField): void {
    const nextDir =
      currentSort.field === field
        ? currentSort.dir === "asc"
          ? "desc"
          : "asc"
        : defaultSortDirections[field];
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", serializeSort({ field, dir: nextDir }));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function ariaSort(field: SortField): "ascending" | "descending" | "none" {
    if (currentSort.field !== field) return "none";
    return currentSort.dir === "asc" ? "ascending" : "descending";
  }

  function sortArrow(field: SortField) {
    if (currentSort.field !== field) return null;

    return (
      <span aria-hidden className="text-xs">
        {currentSort.dir === "asc" ? "▲" : "▼"}
      </span>
    );
  }

  return (
    <>
      <div className="mt-8 rounded-xl border border-black/15 dark:border-white/20">
        <div className="flex min-h-12 items-center border-b border-black/10 px-2 dark:border-white/15 lg:hidden">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 px-2 text-sm font-medium">
            <input
              ref={mobileHeaderCheckboxRef}
              type="checkbox"
              checked={allOnPageSelected}
              onChange={() => selectAll(pageIds)}
              aria-label={`Select all ${items.length} listings on the current page`}
              className="size-5 cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            />
            Select page
          </label>
        </div>

        <table className="block w-full text-sm lg:table lg:table-fixed">
          <caption className="sr-only">Your listings</caption>
          <colgroup className="hidden lg:table-column-group">
            <col className="w-13" />
            <col />
            <col className="w-28" />
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-44" />
            <col className="w-36" />
          </colgroup>
          <thead className="hidden lg:table-header-group">
          <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/15 dark:text-white/60">
            <th scope="col" className="px-2 py-1 font-medium">
              <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={() => selectAll(pageIds)}
                  aria-label={`Select all ${items.length} listings on the current page`}
                  className="size-5 cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                />
              </label>
            </th>
            <th scope="col" aria-sort={ariaSort("title")} className="font-medium">
              <button
                type="button"
                onClick={() => onSort("title")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-4 py-3 text-left hover:text-black dark:hover:text-white"
              >
                Listing
                {sortArrow("title")}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("status")} className="font-medium">
              <button
                type="button"
                onClick={() => onSort("status")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-4 py-3 text-left hover:text-black dark:hover:text-white"
              >
                Status
                {sortArrow("status")}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("channels")} className="font-medium">
              <button
                type="button"
                onClick={() => onSort("channels")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-4 py-3 text-left hover:text-black dark:hover:text-white"
              >
                Channels
                {sortArrow("channels")}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("price")} className="font-medium">
              <button
                type="button"
                onClick={() => onSort("price")}
                className="flex min-h-11 w-full cursor-pointer items-center justify-end gap-1.5 px-3 py-3 text-right hover:text-black dark:hover:text-white"
              >
                Price
                {sortArrow("price")}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("days")} className="font-medium">
              <button
                type="button"
                onClick={() => onSort("days")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-3 py-3 text-left hover:text-black dark:hover:text-white"
              >
                Activity
                {sortArrow("days")}
              </button>
            </th>
            <th scope="col" className="px-3 py-3 text-right font-medium">
              Actions
            </th>
          </tr>
          </thead>
          <tbody className="block lg:table-row-group">
          {items.map((item, index) => {
            const photo = item.photos[0];
            const status = STATUS_STYLES[item.status];
            const listedDays = daysListed(item, now);
            const metadata = [item.brand, item.size, item.category].filter(
              (value: string | null): value is string => value !== null,
            );
            const addedLabel = new Date(item.createdAt).toLocaleDateString(
              "en-US",
              dateFormatOptions,
            );
            const soldDateLabel = item.soldDate
              ? new Date(item.soldDate).toLocaleDateString(
                  "en-US",
                  dateFormatOptions,
                )
              : null;
            const itemHref = carryListingContext(
              `/listings/${item.id}`,
              searchParams,
            );
            const editHref = carryListingContext(
              `/listings/${item.id}/edit`,
              searchParams,
            );

            return (
              <tr
                key={item.id}
                onClick={() => router.push(itemHref)}
                className="grid cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-black/10 p-3 last:border-b-0 hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.04] lg:table-row lg:p-0"
              >
                <td
                  onClick={(event) => event.stopPropagation()}
                  className="block lg:table-cell lg:px-2 lg:py-1"
                >
                  <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={(event) => onRowSelection(event, item.id)}
                      aria-label={`Select ${item.title}`}
                      className="size-5 cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                    />
                  </label>
                </td>
                <td className="block min-w-0 lg:table-cell lg:px-3 lg:py-3">
                  <Link
                    href={itemHref}
                    onClick={(event) => event.stopPropagation()}
                    className="flex min-w-0 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    {photo ? (
                      <Image
                        src={photo}
                        alt=""
                        width={48}
                        height={48}
                        sizes="48px"
                        loading={index === 0 ? "eager" : "lazy"}
                        className="size-12 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <span className="size-12 shrink-0 rounded-md bg-black/[.05] dark:bg-white/[.06]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium hover:underline">
                        {item.title}
                      </span>
                      {metadata.length > 0 && (
                        <span className="mt-0.5 block truncate text-xs text-black/55 dark:text-white/55">
                          {metadata.join(" · ")}
                        </span>
                      )}

                      <span className="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <ChannelIndicator postings={item.postings} />
                      </span>

                      <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs lg:hidden">
                        <span>
                          <span className="font-semibold">
                            {item.soldPrice === null
                              ? currencyFormatter.format(item.listPrice)
                              : `Sold ${currencyFormatter.format(item.soldPrice)}`}
                          </span>
                          {item.soldPrice !== null && (
                            <span className="ml-1.5 text-black/50 dark:text-white/50">
                              Listed {currencyFormatter.format(item.listPrice)}
                            </span>
                          )}
                        </span>
                        <span className="text-black/55 dark:text-white/55">
                          {soldDateLabel === null
                            ? `${listedDays} ${listedDays === 1 ? "day" : "days"}`
                            : `Sold ${soldDateLabel}`}
                        </span>
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="hidden px-3 py-3 lg:table-cell">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 lg:table-cell">
                  <ChannelIndicator postings={item.postings} />
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 text-right lg:table-cell">
                  <span className="block font-semibold">
                    {item.soldPrice === null
                      ? currencyFormatter.format(item.listPrice)
                      : `Sold ${currencyFormatter.format(item.soldPrice)}`}
                  </span>
                  {item.soldPrice !== null && (
                    <span className="mt-0.5 block text-xs text-black/50 dark:text-white/50">
                      Listed {currencyFormatter.format(item.listPrice)}
                    </span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 lg:table-cell">
                  <span className="block font-medium">
                    {soldDateLabel === null
                      ? `${listedDays} ${listedDays === 1 ? "day" : "days"}`
                      : `Sold ${soldDateLabel}`}
                  </span>
                  <span className="mt-0.5 block text-xs text-black/50 dark:text-white/50">
                    {soldDateLabel === null
                      ? `Added ${addedLabel}`
                      : `${listedDays} ${listedDays === 1 ? "day" : "days"} listed`}
                  </span>
                </td>
                <td
                  onClick={(event) => event.stopPropagation()}
                  className="block whitespace-nowrap text-right lg:table-cell lg:px-3 lg:py-3"
                >
                  <ListingRowActions
                    item={item}
                    variant="table"
                    editHref={editHref}
                  />
                </td>
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>
    </>
  );
}

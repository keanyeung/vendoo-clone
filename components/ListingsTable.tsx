"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import MarkSoldDialog from "@/components/MarkSoldDialog";
import type { ItemDto } from "@/lib/item-dto";
import {
  daysListed,
  parseSort,
  serializeSort,
  type SortField,
} from "@/lib/listing-sort";
import { STATUS_STYLES } from "@/lib/status-style";

type ListingsTableProps = {
  items: ItemDto[];
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
  soldDate: "desc",
};

export default function ListingsTable({ items, now }: ListingsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sellItem, setSellItem] = useState<ItemDto | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const currentSort = parseSort(searchParams.get("sort"));

  async function changeStatus(
    item: ItemDto,
    status: "DRAFT" | "LISTED",
  ): Promise<void> {
    if (pendingId) return;
    setPendingId(item.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", data: { status } }),
      });
      if (!res.ok) {
        let message = `Update failed (status ${res.status}).`;
        try {
          const body: unknown = await res.json();
          if (
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
          ) {
            message = body.error;
          }
        } catch {
          // Keep the status-based fallback when the response is not JSON.
        }
        setActionError(message);
        return;
      }
      router.refresh();
    } catch {
      setActionError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPendingId(null);
    }
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
      {actionError && (
        <div
          role="alert"
          className="mt-8 flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
        >
          <p>{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="shrink-0 font-medium"
            aria-label="Dismiss action error"
          >
            Dismiss
          </button>
        </div>
      )}
      <div
        className={`${actionError ? "mt-3" : "mt-8"} overflow-x-auto rounded-xl border border-black/15 dark:border-white/20`}
      >
      <table className="w-full text-sm">
        <caption className="sr-only">Your listings</caption>
        <thead>
          <tr className="border-b border-black/10 text-left text-black/60 dark:border-white/15 dark:text-white/60">
            <th scope="col" className="px-4 py-3 font-medium">Photo</th>
            <th scope="col" aria-sort={ariaSort("title")} className="font-medium">
              <button
                type="button"
                onClick={() => onSort("title")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-4 py-3 text-left hover:text-black dark:hover:text-white"
              >
                Title
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
            <th scope="col" aria-sort={ariaSort("price")} className="font-medium">
              <button
                type="button"
                onClick={() => onSort("price")}
                className="flex min-h-11 w-full cursor-pointer items-center justify-end gap-1.5 px-4 py-3 text-right hover:text-black dark:hover:text-white"
              >
                List price
                {sortArrow("price")}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("sold")} className="font-medium hidden sm:table-cell">
              <button
                type="button"
                onClick={() => onSort("sold")}
                className="flex min-h-11 w-full cursor-pointer items-center justify-end gap-1.5 px-4 py-3 text-right hover:text-black dark:hover:text-white"
              >
                Sold price
                {sortArrow("sold")}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("added")} className="font-medium hidden sm:table-cell">
              <button
                type="button"
                onClick={() => onSort("added")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-4 py-3 text-left hover:text-black dark:hover:text-white"
              >
                Added
                {sortArrow("added")}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("days")} className="font-medium hidden sm:table-cell">
              <button
                type="button"
                onClick={() => onSort("days")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-4 py-3 text-left hover:text-black dark:hover:text-white"
              >
                Days listed
                {sortArrow("days")}
              </button>
            </th>
            <th scope="col" aria-sort={ariaSort("soldDate")} className="font-medium hidden sm:table-cell">
              <button
                type="button"
                onClick={() => onSort("soldDate")}
                className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 px-4 py-3 text-left hover:text-black dark:hover:text-white"
              >
                Sold date
                {sortArrow("soldDate")}
              </button>
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium hidden sm:table-cell">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: ItemDto) => {
            const photo = item.photos[0];
            const status = STATUS_STYLES[item.status];
            const listedDays = daysListed(item, now);

            return (
              <tr
                key={item.id}
                onClick={() => router.push(`/listings/${item.id}`)}
                className="cursor-pointer border-b border-black/10 last:border-b-0 hover:bg-black/[.03] dark:border-white/15 dark:hover:bg-white/[.04]"
              >
                <td className="px-4 py-3">
                  {photo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo}
                        alt={item.title}
                        className="h-10 w-10 rounded object-cover"
                      />
                    </>
                  ) : (
                    <div className="h-10 w-10 rounded bg-black/[.05] dark:bg-white/[.06]" />
                  )}
                </td>
                <td className="max-w-64 px-4 py-3">
                  <Link
                    href={`/listings/${item.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate font-medium hover:underline"
                  >
                    {item.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {currencyFormatter.format(item.listPrice)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right hidden sm:table-cell">
                  {item.soldPrice === null
                    ? "—"
                    : currencyFormatter.format(item.soldPrice)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 hidden sm:table-cell">
                  {new Date(item.createdAt).toLocaleDateString(
                    "en-US",
                    dateFormatOptions,
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 hidden sm:table-cell">
                  {listedDays} {listedDays === 1 ? "day" : "days"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 hidden sm:table-cell">
                  {item.soldDate
                    ? new Date(item.soldDate).toLocaleDateString(
                        "en-US",
                        dateFormatOptions,
                      )
                    : "—"}
                </td>
                <td
                  onClick={(event) => event.stopPropagation()}
                  className="whitespace-nowrap px-4 py-3 text-right hidden sm:table-cell"
                >
                  {item.status === "SOLD" ? (
                    <button
                      type="button"
                      onClick={() => void changeStatus(item, "LISTED")}
                      disabled={pendingId === item.id}
                      className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
                    >
                      Relist
                    </button>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <select
                        aria-label={`Change status for ${item.title}`}
                        value={item.status}
                        onChange={(event) =>
                          void changeStatus(
                            item,
                            event.target.value as "DRAFT" | "LISTED",
                          )
                        }
                        disabled={pendingId === item.id}
                        className="rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="LISTED">Listed</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setSellItem(item)}
                        disabled={pendingId === item.id}
                        className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Mark sold
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <MarkSoldDialog
        item={sellItem}
        onClose={() => setSellItem(null)}
        onSold={() => {
          setSellItem(null);
          router.refresh();
        }}
      />
    </>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import MarkSoldDialog from "@/components/MarkSoldDialog";
import { UndoToast } from "@/components/UndoToast";
import { computeProfit } from "@/lib/analytics";
import type { DashboardSummary } from "@/lib/dashboard";
import type { ItemDto } from "@/lib/item-dto";
import type { MarkSoldInput } from "@/lib/item-schema";
import { daysListed } from "@/lib/listing-sort";
import { PLATFORM_LABELS } from "@/lib/platform-label";
import { STATUS_STYLES } from "@/lib/status-style";

// `now` is a prop rather than a Date.now() call in the body: reading the clock here would make
// this component impure (react-hooks/purity) and let rows disagree with the rest of the page.
export type DashboardListingsProps = {
  summary: DashboardSummary;
  now: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type SaleToastState = {
  itemId: string;
  previousStatus: "DRAFT" | "LISTED";
  message: string;
  tone?: "default" | "error";
};

async function readResponseError(response: Response): Promise<string> {
  let message = `Undo failed with status ${response.status}.`;

  try {
    const body: unknown = await response.json();
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

  return message;
}

// UTC because soldDate is persisted as UTC midnight from a date picker; formatting it in the
// server's zone would render "Jul 23" for a sale the rest of the app buckets into Jul 24.
const soldDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

// The sold row has four shapes depending on which of soldDate/soldPlatform survived data entry;
// returning null for the all-missing case lets the caller drop the segment separator with it.
function formatSoldSegment(item: ItemDto): string | null {
  const date =
    item.soldDate === null
      ? null
      : soldDateFormatter.format(new Date(item.soldDate));
  const platform =
    item.soldPlatform === null ? null : PLATFORM_LABELS[item.soldPlatform];

  if (date === null && platform === null) {
    return null;
  }

  const when = date === null ? "sold" : `sold ${date}`;
  return platform === null ? when : `${when} on ${platform}`;
}

// Built here rather than inline in JSX so the null-dropping stays readable: any missing field
// must vanish along with its separator, never leave a dangling " · ".
function buildMetaLine(item: ItemDto, now: number): string {
  const age = daysListed(item, now);
  const days = age === 1 ? "1 day" : `${age} days`;
  const segments: (string | null)[] = [
    item.category,
    item.size,
    item.status === "SOLD"
      ? formatSoldSegment(item)
      : item.status === "DRAFT"
        ? `added ${days} ago`
        : `${days} listed`,
  ];

  return segments
    .filter(
      (segment: string | null): segment is string =>
        segment !== null && segment.trim() !== "",
    )
    .join(" · ");
}

export default function DashboardListings({
  summary,
  now,
}: DashboardListingsProps) {
  const router = useRouter();
  const [sellItem, setSellItem] = useState<ItemDto | null>(null);
  const [saleToast, setSaleToast] = useState<SaleToastState | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const chips = [
    { status: "LISTED", label: "Listed", count: summary.activeListings },
    { status: "DRAFT", label: "Drafts", count: summary.draftCount },
    { status: "SOLD", label: "Sold", count: summary.soldCount },
  ];

  function handleSold(sale: MarkSoldInput): void {
    if (sellItem === null) return;

    const profit = computeProfit({
      soldPrice: sale.soldPrice,
      purchasePrice: sellItem.purchasePrice,
      platformFees: sale.platformFees,
      shippingCost: sale.shippingCost,
    });
    setSaleToast({
      itemId: sellItem.id,
      previousStatus: sellItem.status === "DRAFT" ? "DRAFT" : "LISTED",
      message: `Marked as sold · ${currencyFormatter.format(sale.soldPrice)} · profit ${currencyFormatter.format(profit ?? 0)}`,
    });
    setSellItem(null);
    router.refresh();
  }

  async function undoSale(): Promise<void> {
    if (saleToast === null || isUndoing) return;

    setIsUndoing(true);
    try {
      const response = await fetch(`/api/items/${saleToast.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          data: { status: saleToast.previousStatus },
        }),
      });

      if (!response.ok) {
        setSaleToast({
          ...saleToast,
          message: await readResponseError(response),
          tone: "error",
        });
        return;
      }

      setSaleToast(null);
      router.refresh();
    } catch {
      setSaleToast({
        ...saleToast,
        message:
          "Could not reach the item service. The sale was not undone; try again.",
        tone: "error",
      });
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]">
      <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4.5 dark:border-white/15">
        <div>
          <h2 className="text-base font-semibold">Listings</h2>
          <p className="mt-1 text-[13px] text-black/60 dark:text-white/60">
            {`${summary.activeListings} active · ${summary.draftCount} drafts · ${summary.soldCount} sold all time`}
          </p>
        </div>
        <Link
          href="/listings"
          className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-black/15 px-3 text-[13px] font-medium text-black/60 dark:border-white/20 dark:text-white/60"
        >
          View all →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-black/10 px-5 py-3.5 dark:border-white/15">
        {chips.map((chip) => (
          <Link
            key={chip.status}
            href={`/listings?status=${chip.status}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-black/[.04] px-3 text-[13px] text-black/60 dark:bg-white/[.06] dark:text-white/60"
          >
            {/* Inline flow instead of a flex gap: it keeps the count and its label on one shared
                baseline the way the reference does, while items-center still centres the pair
                inside the 44px tap target that items-baseline would have top-aligned. */}
            <span>
              <b className="mr-1.5 text-[15px] font-semibold text-foreground">
                {chip.count}
              </b>
              {chip.label}
            </span>
          </Link>
        ))}
      </div>

      {summary.recent.map((item: ItemDto, index: number) => {
        const photo = item.photos[0];
        const status = STATUS_STYLES[item.status];

        return (
          <div
            key={item.id}
            className="flex items-center gap-2 border-b border-black/[.06] pr-5 last:border-b-0 hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/[.04]"
          >
            <Link
              href={`/listings/${item.id}`}
              className="flex min-w-0 flex-1 items-center gap-3.5 py-3 pl-5"
            >
              {photo ? (
                <Image
                  src={photo}
                  alt=""
                  width={48}
                  height={48}
                  sizes="48px"
                  loading={index === 0 ? "eager" : "lazy"}
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="size-12 shrink-0 rounded-lg bg-black/[.04] dark:bg-white/[.06]" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {/* Truncated like the title: unwrapped, this line runs to four rows on a
                    phone and pushes the badge and price out of alignment. */}
                <p className="mt-0.5 truncate text-xs text-black/60 dark:text-white/60">
                  {buildMetaLine(item, now)}
                </p>
              </div>

              <span
                className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline ${status.className}`}
              >
                {status.label}
              </span>

              <span className="hidden w-18 shrink-0 text-right text-sm font-semibold sm:block">
                {currencyFormatter.format(item.listPrice)}
              </span>
            </Link>

            {item.status !== "SOLD" && (
              <button
                type="button"
                onClick={() => setSellItem(item)}
                aria-label={`Mark ${item.title} as sold`}
                className="min-h-11 shrink-0 rounded-md bg-foreground px-3 text-xs font-semibold text-background"
              >
                <span className="sm:hidden">Sell</span>
                <span className="hidden sm:inline">Mark sold</span>
              </button>
            )}
          </div>
        );
      })}

      </section>

      <MarkSoldDialog
        item={sellItem}
        onClose={() => setSellItem(null)}
        onSold={handleSold}
      />

      {saleToast !== null && (
        <UndoToast
          message={saleToast.message}
          onUndo={
            saleToast.tone === "error" ? undefined : () => void undoSale()
          }
          onDismiss={() => setSaleToast(null)}
          isUndoing={isUndoing}
          tone={saleToast.tone}
        />
      )}
    </>
  );
}

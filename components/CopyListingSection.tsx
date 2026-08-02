"use client";

import type { ListingCopyController } from "@/components/useListingCopy";
import { useListingCopy } from "@/components/useListingCopy";
import type { ItemDto } from "@/lib/item-dto";
import {
  formatPrice,
  LISTING_PLATFORMS,
  PLATFORM_LABELS,
} from "@/lib/listing-text";
import type { ListingPlatform } from "@/lib/listing-text";

export type CopyListingSectionProps = {
  item: ItemDto;
  showCopyActions?: boolean;
  hideCopyActionsOnMobile?: boolean;
  className?: string;
};

export type ControlledCopyListingSectionProps = CopyListingSectionProps & {
  copy: ListingCopyController;
};

function CopyListingSectionView({
  item,
  copy,
  showCopyActions = true,
  hideCopyActionsOnMobile = false,
  className = "mt-8",
}: ControlledCopyListingSectionProps) {
  return (
    <section
      className={`${className} rounded-xl border border-black/15 p-6 dark:border-white/20`}
    >
      <h2 className="text-lg font-semibold">Copy &amp; paste</h2>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Formatted for each marketplace. Paste into their app.
      </p>

      <div className="mt-4 flex gap-2" aria-label="Listing platform">
        {LISTING_PLATFORMS.map((platform: ListingPlatform) => (
          <button
            key={platform}
            type="button"
            onClick={() => copy.selectPlatform(platform)}
            aria-pressed={copy.selectedPlatform === platform}
            className={
              copy.selectedPlatform === platform
                ? "inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-foreground px-3 text-sm font-medium text-background"
                : "inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium dark:border-white/20"
            }
          >
            {PLATFORM_LABELS[platform]}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <div className="rounded-md border border-black/15 bg-black/[.03] p-4 dark:border-white/20 dark:bg-white/[.04]">
          <div className="flex items-center justify-between gap-4 text-xs tracking-[0.06em] text-black/60 uppercase dark:text-white/60">
            <span>Title</span>
            <span
              className={
                copy.sourceTitleExceedsLimit
                  ? "text-red-600 dark:text-red-400"
                  : undefined
              }
            >
              {copy.sourceTitleLength} / {copy.titleLimit}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6">{copy.title}</p>
          {copy.titleWasTruncated && (
            <p className="mt-2 text-xs text-black/60 dark:text-white/60">
              Trimmed to fit eBay&apos;s title limit.
            </p>
          )}
        </div>

        <div className="rounded-md border border-black/15 bg-black/[.03] p-4 dark:border-white/20 dark:bg-white/[.04]">
          <div className="flex items-center justify-between gap-4 text-xs tracking-[0.06em] text-black/60 uppercase dark:text-white/60">
            <span>Description</span>
            <span>{copy.descriptionLength} chars</span>
          </div>
          <p className="mt-2 max-h-80 overflow-y-auto whitespace-pre-line text-sm leading-6">
            {copy.listingText}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">
              Price to enter: {formatPrice(item.listPrice)}
            </p>
            <p className="mt-1 max-w-52 text-xs text-black/60 dark:text-white/60">
              Enter this in the platform&apos;s own price field.
            </p>
          </div>

          {showCopyActions && (
            <div
              className={`flex-col gap-2 ${
                hideCopyActionsOnMobile ? "hidden lg:flex" : "flex"
              }`}
            >
              <button
                type="button"
                onClick={() => void copy.copyListing()}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background"
              >
                {copy.copiedTarget === "listing"
                  ? "✓ Copied"
                  : "Copy description"}
              </button>
              <button
                type="button"
                onClick={() => void copy.copyTitle()}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium dark:border-white/20"
              >
                {copy.copiedTarget === "title"
                  ? "✓ Copied"
                  : "Copy title only"}
              </button>
            </div>
          )}
        </div>
      </div>

      {copy.error !== null && (
        <div
          role="alert"
          className="mt-4 flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
        >
          <p>{copy.error}</p>
          <button
            type="button"
            onClick={copy.dismissError}
            className="min-h-11 shrink-0 font-medium"
            aria-label="Dismiss copy error"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}

// Existing item-detail surfaces keep a self-contained copy card, while /new can
// control the same view so its future mobile action bar shares platform state.
export function CopyListingSection(props: CopyListingSectionProps) {
  const copy = useListingCopy(props.item);
  return <CopyListingSectionView {...props} copy={copy} />;
}

export function ControlledCopyListingSection(
  props: ControlledCopyListingSectionProps,
) {
  return <CopyListingSectionView {...props} />;
}

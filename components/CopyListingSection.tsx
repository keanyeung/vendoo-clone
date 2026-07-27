"use client";

import { useEffect, useRef, useState } from "react";

import type { ItemDto } from "@/lib/item-dto";
import {
  EBAY_TITLE_MAX_LENGTH,
  formatListingText,
  formatPrice,
  LISTING_PLATFORMS,
  PLATFORM_LABELS,
  truncateTitle,
} from "@/lib/listing-text";
import type { ListingPlatform } from "@/lib/listing-text";

export type CopyListingSectionProps = {
  item: ItemDto;
};

type CopyTarget = "listing" | "title";

export function CopyListingSection({ item }: CopyListingSectionProps) {
  const [selectedPlatform, setSelectedPlatform] =
    useState<ListingPlatform>("FB_MARKETPLACE");
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listingText = formatListingText(item, selectedPlatform);
  const title =
    selectedPlatform === "EBAY"
      ? truncateTitle(item.title, EBAY_TITLE_MAX_LENGTH)
      : item.title;

  function clearConfirmation(): void {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setCopiedTarget(null);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function selectPlatform(platform: ListingPlatform): void {
    clearConfirmation();
    setError(null);
    setSelectedPlatform(platform);
  }

  async function copyText(text: string, target: CopyTarget): Promise<void> {
    clearConfirmation();
    setError(null);

    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      timeoutRef.current = setTimeout(() => {
        setCopiedTarget(null);
        timeoutRef.current = null;
      }, 2000);
    } catch {
      setError(
        "Copying was blocked. You can select the preview text and copy it manually.",
      );
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
      <h2 className="text-lg font-semibold">Copy listing</h2>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        These platforms have no listing API, so copy this text into their
        forms.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Listing platform">
        {LISTING_PLATFORMS.map((platform: ListingPlatform) => (
          <button
            key={platform}
            type="button"
            onClick={() => selectPlatform(platform)}
            aria-pressed={selectedPlatform === platform}
            className={
              selectedPlatform === platform
                ? "rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
                : "rounded-md border border-black/15 px-3 py-2 text-sm font-medium dark:border-white/20"
            }
          >
            {PLATFORM_LABELS[platform]}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-black/15 bg-black/[.03] p-4 font-sans text-sm leading-6 dark:border-white/20 dark:bg-white/[.04]">
          {listingText}
        </pre>
        <div className="md:min-w-48">
          <p className="text-sm text-black/60 dark:text-white/60">
            List price
          </p>
          <p className="mt-1 text-xl font-semibold">
            {formatPrice(item.listPrice)}
          </p>
          <p className="mt-1 max-w-48 text-xs text-black/60 dark:text-white/60">
            Enter this in the platform&apos;s own price field.
          </p>
          {selectedPlatform === "EBAY" && (
            <p className="mt-3 text-xs text-black/60 dark:text-white/60">
              Title: {title.length}/{EBAY_TITLE_MAX_LENGTH} characters
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void copyText(listingText, "listing")}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          {copiedTarget === "listing" ? "Copied" : "Copy listing"}
        </button>
        <button
          type="button"
          onClick={() => void copyText(title, "title")}
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
        >
          {copiedTarget === "title" ? "Copied" : "Copy title only"}
        </button>
      </div>

      {error !== null && (
        <div
          role="alert"
          className="mt-4 flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 font-medium"
            aria-label="Dismiss copy error"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}

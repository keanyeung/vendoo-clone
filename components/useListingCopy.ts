"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemDto } from "@/lib/item-dto";
import {
  formatListingText,
  TITLE_LIMITS,
  truncateTitle,
} from "@/lib/listing-text";
import type { ListingPlatform } from "@/lib/listing-text";

export type CopyTarget = "listing" | "title";

export type ListingCopyController = {
  selectedPlatform: ListingPlatform;
  listingText: string;
  title: string;
  titleLimit: number;
  sourceTitleLength: number;
  sourceTitleExceedsLimit: boolean;
  titleWasTruncated: boolean;
  descriptionLength: number;
  copiedTarget: CopyTarget | null;
  error: string | null;
  selectPlatform: (platform: ListingPlatform) => void;
  copyListing: () => Promise<void>;
  copyTitle: () => Promise<void>;
  clearFeedback: () => void;
  dismissError: () => void;
  reset: () => void;
};

export function useListingCopy(
  item: ItemDto | null,
): ListingCopyController {
  const [selectedPlatform, setSelectedPlatform] =
    useState<ListingPlatform>("FB_MARKETPLACE");
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listingText =
    item === null ? "" : formatListingText(item, selectedPlatform);
  const titleLimit = TITLE_LIMITS[selectedPlatform];
  const sourceTitleLength = item?.title.length ?? 0;
  const sourceTitleExceedsLimit = sourceTitleLength > titleLimit;
  const title =
    item === null
      ? ""
      : selectedPlatform === "EBAY"
        ? truncateTitle(item.title, TITLE_LIMITS.EBAY)
        : item.title;
  const titleWasTruncated = item !== null && title !== item.title;

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

  function clearFeedback(): void {
    clearConfirmation();
    setError(null);
  }

  function selectPlatform(platform: ListingPlatform): void {
    clearFeedback();
    setSelectedPlatform(platform);
  }

  async function copyText(text: string, target: CopyTarget): Promise<void> {
    clearFeedback();
    if (item === null) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      timeoutRef.current = setTimeout(() => {
        setCopiedTarget(null);
        timeoutRef.current = null;
      }, 1600);
    } catch {
      setError(
        "Copying was blocked. You can select the preview text and copy it manually.",
      );
    }
  }

  function reset(): void {
    clearFeedback();
    setSelectedPlatform("FB_MARKETPLACE");
  }

  return {
    selectedPlatform,
    listingText,
    title,
    titleLimit,
    sourceTitleLength,
    sourceTitleExceedsLimit,
    titleWasTruncated,
    descriptionLength: listingText.length,
    copiedTarget,
    error,
    selectPlatform,
    copyListing: () => copyText(listingText, "listing"),
    copyTitle: () => copyText(title, "title"),
    clearFeedback,
    dismissError: () => setError(null),
    reset,
  };
}

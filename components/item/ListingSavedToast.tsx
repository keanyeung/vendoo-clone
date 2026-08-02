"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { carryListingContext } from "@/lib/listing-context";

export function ListingSavedToast({
  itemId,
  show,
  from = null,
}: {
  itemId: string;
  show: boolean;
  from?: string | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState<boolean>(show);
  const cleanHref = from
    ? carryListingContext(`/listings/${itemId}`, { from })
    : `/listings/${itemId}`;

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout((): void => {
      setVisible(false);
      router.replace(cleanHref, { scroll: false });
    }, 4000);
    return () => clearTimeout(timer);
  }, [cleanHref, router, show]);

  function dismiss(): void {
    setVisible(false);
    router.replace(cleanHref, { scroll: false });
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-black/15 bg-background px-4 py-3 text-sm text-foreground shadow-xl dark:border-white/20"
    >
      <p className="min-w-0 flex-1 font-medium">Listing saved</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss saved notification"
        className="inline-flex size-9 items-center justify-center rounded-md text-xl text-black/55 hover:bg-black/[.05] dark:text-white/55 dark:hover:bg-white/[.07]"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

export function ResumeDraftBanner({
  id,
  title,
  photoCount,
  savedLabel,
}: {
  id: string;
  title: string;
  photoCount: number;
  savedLabel: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside className="flex items-center gap-3 rounded-xl border border-black/15 bg-black/[.03] px-4 py-3 text-sm dark:border-white/20 dark:bg-white/[.04]">
      <Link
        href={`/new?draft=${encodeURIComponent(id)}`}
        className="inline-flex min-h-11 min-w-0 flex-1 items-center py-2 font-medium underline decoration-black/25 underline-offset-4 hover:decoration-current dark:decoration-white/30"
      >
        Resume your last draft — {title}, {photoCount}{" "}
        {photoCount === 1 ? "photo" : "photos"}, saved {savedLabel}
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss resume draft banner"
        className="inline-flex min-h-11 shrink-0 items-center rounded-md px-3 font-medium text-black/60 hover:bg-black/[.05] dark:text-white/60 dark:hover:bg-white/[.07]"
      >
        Dismiss
      </button>
    </aside>
  );
}

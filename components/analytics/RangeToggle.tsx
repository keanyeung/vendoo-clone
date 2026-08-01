"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  SALES_RANGES,
  SALES_RANGE_LABELS,
  type SalesRange,
} from "@/lib/analytics";

export type RangeToggleProps = { range: SalesRange };

export default function RangeToggle({ range }: RangeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();

  function selectRange(value: SalesRange): void {
    router.replace(`${pathname}?range=${value}`, { scroll: false });
  }

  return (
    <div
      aria-label="Analytics range"
      className="flex rounded-lg border border-black/15 p-1 dark:border-white/20"
    >
      {SALES_RANGES.map((value: SalesRange) => {
        const isSelected = value === range;

        return (
          <button
            key={value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => selectRange(value)}
            className={`min-h-9 rounded-md px-3 py-1.5 text-sm transition-colors ${
              isSelected
                ? "bg-foreground font-semibold text-background"
                : "bg-transparent font-medium text-black/60 hover:bg-black/[.04] dark:text-white/60 dark:hover:bg-white/[.06]"
            }`}
          >
            {SALES_RANGE_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}

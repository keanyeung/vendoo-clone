"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  ANALYTICS_RANGES,
  RANGE_LABELS,
  type AnalyticsRange,
} from "@/lib/analytics";

export type AnalyticsRangeToggleProps = {
  range: AnalyticsRange;
};

export default function AnalyticsRangeToggle({
  range,
}: AnalyticsRangeToggleProps) {
  const router = useRouter();
  const pathname = usePathname();

  function selectRange(value: AnalyticsRange): void {
    router.replace(value === "all" ? pathname : `${pathname}?range=${value}`);
  }

  return (
    <div className="mt-5 flex w-fit flex-wrap gap-2" aria-label="Analytics range">
      {ANALYTICS_RANGES.map((value: AnalyticsRange) => {
        const isSelected = value === range;

        return (
          <button
            key={value}
            type="button"
            aria-pressed={isSelected}
            onClick={(): void => selectRange(value)}
            className={`min-h-11 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isSelected
                ? "bg-foreground text-background"
                : "border border-black/15 hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
            }`}
          >
            {RANGE_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}

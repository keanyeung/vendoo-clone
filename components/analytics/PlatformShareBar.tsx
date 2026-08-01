import type { PlatformSlice } from "@/lib/analytics";
import {
  PLATFORM_BAR_CLASSES,
  PLATFORM_SHORT_LABELS,
  formatMoney,
} from "@/lib/sales-format";

export type PlatformShareBarProps = {
  platforms: PlatformSlice[];
};

export default function PlatformShareBar({
  platforms,
}: PlatformShareBarProps) {
  const platformCaption = platforms.length
    ? platforms
        .map(
          ({ platform, sharePct }) =>
            `${PLATFORM_SHORT_LABELS[platform]} ${Math.round(sharePct)}%`,
        )
        .join(" · ")
    : "No profit to split yet";
  const barLabel = platforms.length
    ? `Platform profit share: ${platformCaption}`
    : platformCaption;

  return (
    <>
      <div
        aria-label={barLabel}
        className="flex h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
        role="img"
      >
        {platforms.map(({ platform, profit, sharePct }) => (
          <div
            aria-hidden="true"
            className={PLATFORM_BAR_CLASSES[platform]}
            key={platform}
            style={{ width: `${sharePct}%` }}
            title={`${PLATFORM_SHORT_LABELS[platform]} · ${formatMoney(profit)}`}
          />
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-black/60 dark:text-white/60">
        {platformCaption}
      </p>
    </>
  );
}

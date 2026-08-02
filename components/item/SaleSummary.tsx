import { computeProfit, computeRoi } from "@/lib/analytics";
import { chargesFees } from "@/lib/fees";
import type { ItemDto } from "@/lib/item-dto";
import { formatPrice } from "@/lib/listing-text";
import { PLATFORM_LABELS } from "@/lib/platform-label";
import { EditSaleButton } from "@/components/item/EditSaleButton";
import {
  PROFIT_TONE_CLASSES,
  profitTone,
} from "@/lib/profit-tone";

type SaleSummaryProps = {
  item: ItemDto;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SaleSummary({ item }: SaleSummaryProps) {
  const profit = computeProfit(item);
  const roi = computeRoi(item);
  const profitClass =
    profit === null
      ? ""
      : PROFIT_TONE_CLASSES[profitTone(profit)];
  const platformLabel =
    item.soldPlatform === null
      ? "Not recorded"
      : PLATFORM_LABELS[item.soldPlatform];
  const dateLabel =
    item.soldDate === null ? "Not recorded" : formatDate(item.soldDate);
  const showFeeWarning =
    item.soldPlatform !== null &&
    chargesFees(item.soldPlatform) &&
    (item.platformFees === null || item.platformFees === 0);

  return (
    <section className="rounded-xl border border-green-600/25 bg-green-600/[.05] p-6 dark:border-green-400/25 dark:bg-green-400/[.05]">
      <h2 className="font-semibold">
        Sold on {platformLabel} · {dateLabel}
      </h2>

      <dl className="mt-5 grid gap-5 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-black/60 dark:text-white/60">
            Sold price
          </dt>
          <dd className="mt-1 text-[26px] font-semibold tracking-tight">
            {item.soldPrice === null
              ? "Not recorded"
              : formatPrice(item.soldPrice)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-black/60 dark:text-white/60">
            Profit
          </dt>
          <dd
            className={`mt-1 text-[26px] font-semibold tracking-tight ${profitClass}`}
          >
            {profit === null ? "—" : formatPrice(profit)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-black/60 dark:text-white/60">ROI</dt>
          <dd
            className={`mt-1 text-[26px] font-semibold tracking-tight ${profitClass}`}
          >
            {roi === null ? "—" : `${roi.toFixed(1)}%`}
          </dd>
        </div>
      </dl>

      {item.soldPrice !== null && (
        <p className="mt-5 text-sm text-black/60 dark:text-white/60">
          {formatPrice(item.soldPrice)} sold − {formatPrice(item.purchasePrice)} paid
          {" − "}
          {formatPrice(item.platformFees ?? 0)} fees
        </p>
      )}

      {showFeeWarning && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          No fees recorded — profit may be overstated
        </p>
      )}

      <EditSaleButton />
    </section>
  );
}

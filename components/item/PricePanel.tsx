import { computeProfit, computeRoi } from "@/lib/analytics";
import type { SellableItem } from "@/lib/analytics";
import type { ItemDto } from "@/lib/item-dto";
import { formatPrice } from "@/lib/listing-text";
import {
  PROFIT_TONE_CLASSES,
  profitTone,
} from "@/lib/profit-tone";

type PricePanelProps = {
  item: ItemDto;
};

export function PricePanel({ item }: PricePanelProps) {
  const projection: SellableItem = {
    soldPrice: item.listPrice,
    purchasePrice: item.purchasePrice,
    platformFees: null,
  };
  // The projection always has a sold price, so computeProfit cannot return null.
  const projectedProfit = computeProfit(projection) ?? 0;
  const projectedRoi = computeRoi(projection);
  const tone = profitTone(projectedProfit);
  const aiSegments = [
    item.suggestedPrice === null
      ? null
      : `AI suggested ${formatPrice(item.suggestedPrice)}`,
    item.priceLow === null || item.priceHigh === null
      ? null
      : `range ${formatPrice(item.priceLow)}–${formatPrice(item.priceHigh)}`,
    item.aiConfidence === null
      ? null
      : `${item.aiConfidence.replaceAll("_", " ")} confidence`,
  ].filter((segment): segment is string => segment !== null);
  const hasAiReference =
    aiSegments.length > 0 || item.priceReasoning !== null;

  return (
    <section className="rounded-xl border border-black/15 p-6 dark:border-white/20">
      <dl className="grid gap-5 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-black/60 dark:text-white/60">
            Listed at
          </dt>
          <dd className="mt-1 text-[30px] font-semibold tracking-tight">
            {formatPrice(item.listPrice)}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-black/60 dark:text-white/60">
            You paid
          </dt>
          <dd className="mt-1 text-[30px] font-semibold tracking-tight text-black/60 dark:text-white/60">
            {formatPrice(item.purchasePrice)}
          </dd>
        </div>

        <div className="border-l border-black/15 pl-5 dark:border-white/20">
          <dt className="text-sm text-black/60 dark:text-white/60">
            Profit if it sells at list
          </dt>
          <dd
            className={`mt-1 text-[30px] font-semibold tracking-tight ${PROFIT_TONE_CLASSES[tone]}`}
          >
            {formatPrice(projectedProfit)}
          </dd>
          {projectedProfit === 0 ? (
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              Break-even before fees — consider relisting higher
            </p>
          ) : projectedRoi !== null ? (
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              {projectedRoi.toFixed(0)}% ROI before fees
            </p>
          ) : null}
        </div>
      </dl>

      {hasAiReference && (
        <div className="mt-5 border-t border-black/10 pt-4 text-sm dark:border-white/15">
          {aiSegments.length > 0 && (
            <p className="text-black/60 dark:text-white/60">
              {aiSegments.join(" · ")}
            </p>
          )}
          {item.priceReasoning !== null && (
            <details className={aiSegments.length > 0 ? "mt-2" : undefined}>
              <summary className="min-h-11 w-fit cursor-pointer py-3 font-medium sm:min-h-0 sm:py-0">
                Why?
              </summary>
              <p className="mt-2 whitespace-pre-line text-black/70 dark:text-white/70">
                {item.priceReasoning}
              </p>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

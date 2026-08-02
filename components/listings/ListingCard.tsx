import Link from "next/link";

import ListingRowActions from "@/components/listings/ListingRowActions";
import { computeProfit, type SellableItem } from "@/lib/analytics";
import type { ListingRowDto } from "@/lib/item-dto";
import { daysListed } from "@/lib/listing-sort";
import {
  PROFIT_TONE_CLASSES,
  profitTone,
} from "@/lib/profit-tone";
import { STATUS_STYLES } from "@/lib/status-style";

type ListingCardProps = {
  item: ListingRowDto;
  itemHref: string;
  editHref: string;
  now: number;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function ListingCard({
  item,
  itemHref,
  editHref,
  now,
}: ListingCardProps) {
  const photo = item.photos[0];
  const status = STATUS_STYLES[item.status];
  const metadata = [item.brand, item.size, item.category].filter(
    (value: string | null): value is string => value !== null,
  );
  const createdDate = new Date(item.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const listedDays = daysListed(item, now);
  const projection: SellableItem = {
    soldPrice: item.listPrice,
    purchasePrice: item.purchasePrice,
    platformFees: null,
  };
  // The projection always has a sold price, so computeProfit cannot return null.
  const projectedProfit = computeProfit(projection) ?? 0;
  const profitClass = PROFIT_TONE_CLASSES[profitTone(projectedProfit)];

  return (
    <article className="group rounded-xl border border-black/15 transition-colors hover:bg-black/[.03] focus-within:border-black/30 dark:border-white/20 dark:hover:bg-white/[.04] dark:focus-within:border-white/35">
      <Link
        href={itemHref}
        aria-label={`View ${item.title}`}
        className="block overflow-hidden rounded-t-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={`Photo of ${item.title}`}
              className="aspect-square w-full object-cover"
            />
          </>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-black/[.04] text-sm text-black/60 dark:bg-white/[.06] dark:text-white/60">
            No photo
          </div>
        )}
      </Link>

      <div className="space-y-3 border-t border-black/10 p-4 dark:border-white/15">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 line-clamp-2 font-semibold">
            <Link
              href={itemHref}
              className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {item.title}
            </Link>
          </h2>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        <p className="text-lg font-semibold">
          {currencyFormatter.format(item.listPrice)}
        </p>

        {metadata.length > 0 && (
          <p className="text-sm text-black/60 dark:text-white/60">
            {metadata.join(" · ")}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-3 border-t border-black/10 pt-3 text-sm dark:border-white/15">
          <div>
            <dt className="text-xs text-black/60 dark:text-white/60">
              Days listed
            </dt>
            <dd className="mt-1 font-medium">
              {listedDays} {listedDays === 1 ? "day" : "days"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-black/60 dark:text-white/60">
              Profit at list
            </dt>
            <dd className={`mt-1 font-semibold ${profitClass}`}>
              {currencyFormatter.format(projectedProfit)}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-black/60 dark:text-white/60">
          Added {createdDate}
        </p>

        <div className="relative z-10 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <ListingRowActions
            item={item}
            variant="card"
            editHref={editHref}
          />
        </div>
      </div>
    </article>
  );
}

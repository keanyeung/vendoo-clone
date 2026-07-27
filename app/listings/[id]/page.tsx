import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyListingSection } from "@/components/CopyListingSection";
import ItemEditSection from "@/components/ItemEditSection";
import ItemLifecycleSection from "@/components/ItemLifecycleSection";
import ItemSellSection from "@/components/ItemSellSection";
import { computeProfit, computeRoi } from "@/lib/analytics";
import type { ItemDto } from "@/lib/item-dto";
import { toItemDto } from "@/lib/item-dto";
import { prisma } from "@/lib/db";

// This database-backed page must render fresh on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/listings/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const item = await prisma.item.findUnique({
    where: { id },
    select: { title: true },
  });

  return {
    title: item?.title ?? "Item not found",
  };
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const statusStyles = {
  DRAFT: {
    label: "Draft",
    className:
      "bg-black/[.06] text-black/65 dark:bg-white/10 dark:text-white/70",
  },
  LISTED: {
    label: "Listed",
    className: "bg-foreground text-background",
  },
  SOLD: {
    label: "Sold",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  },
} satisfies Record<
  ItemDto["status"],
  { label: string; className: string }
>;

const platformLabels = {
  FB_MARKETPLACE: "Facebook Marketplace",
  DEPOP: "Depop",
  EBAY: "eBay",
} satisfies Record<NonNullable<ItemDto["soldPlatform"]>, string>;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DetailValue({ value }: { value: string | null }) {
  return value ? (
    <dd className="mt-1">{value}</dd>
  ) : (
    <dd className="mt-1 text-black/60 dark:text-white/60">Not identified</dd>
  );
}

export default async function ItemDetailPage(
  props: PageProps<"/listings/[id]">,
) {
  const { id } = await props.params;
  const item = await prisma.item.findUnique({ where: { id } });

  if (item === null) {
    notFound();
  }

  const itemDto = toItemDto(item);
  const status = statusStyles[itemDto.status];
  const createdDate = formatDate(itemDto.createdAt);
  const updatedDate = formatDate(itemDto.updatedAt);
  const hasAiReference =
    itemDto.suggestedPrice !== null ||
    itemDto.priceLow !== null ||
    itemDto.priceHigh !== null ||
    itemDto.priceReasoning !== null ||
    itemDto.aiConfidence !== null;
  const profit = computeProfit(itemDto);
  const roi = computeRoi(itemDto);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <header className="space-y-3">
        <Link
          href="/listings"
          className="inline-block text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
        >
          ← Back to listings
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {itemDto.title}
          </h1>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
          >
            {status.label}
          </span>
        </div>
        <p className="text-sm text-black/60 dark:text-white/60">
          Created {createdDate}
          {itemDto.updatedAt !== itemDto.createdAt &&
            ` · Updated ${updatedDate}`}
        </p>
      </header>

      <section className="mt-8">
        {itemDto.photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {itemDto.photos.map((photoUrl: string, index: number) => (
              <a
                key={`${photoUrl}-${index}`}
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="overflow-hidden rounded-xl border border-black/15 dark:border-white/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={`${itemDto.title}, photo ${index + 1}`}
                  className="aspect-square w-full object-cover"
                />
              </a>
            ))}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-black/15 bg-black/[.04] text-sm text-black/60 dark:border-white/20 dark:bg-white/[.06] dark:text-white/60">
            No photos
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
        <h2 className="text-lg font-semibold">Listing content</h2>
        <p className="mt-4 whitespace-pre-line leading-7">
          {itemDto.description}
        </p>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-black/60 dark:text-white/60">
              Brand
            </dt>
            <DetailValue value={itemDto.brand} />
          </div>
          <div>
            <dt className="text-sm font-medium text-black/60 dark:text-white/60">
              Category
            </dt>
            <DetailValue value={itemDto.category} />
          </div>
          <div>
            <dt className="text-sm font-medium text-black/60 dark:text-white/60">
              Size
            </dt>
            <DetailValue value={itemDto.size} />
          </div>
          <div>
            <dt className="text-sm font-medium text-black/60 dark:text-white/60">
              Color
            </dt>
            <DetailValue value={itemDto.color} />
          </div>
          <div>
            <dt className="text-sm font-medium text-black/60 dark:text-white/60">
              Condition
            </dt>
            <DetailValue
              value={itemDto.condition?.replaceAll("_", " ") ?? null}
            />
          </div>
        </dl>
        {itemDto.conditionNotes !== null && (
          <div className="mt-6 border-t border-black/10 pt-6 dark:border-white/15">
            <h3 className="font-medium">Condition notes</h3>
            <p className="mt-2 whitespace-pre-line text-black/80 dark:text-white/80">
              {itemDto.conditionNotes}
            </p>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
        <h2 className="text-lg font-semibold">Pricing</h2>
        <div className="mt-4 flex flex-wrap gap-x-12 gap-y-5">
          <div>
            <p className="text-sm text-black/60 dark:text-white/60">
              List price
            </p>
            <p className="mt-1 text-3xl font-semibold">
              {currencyFormatter.format(itemDto.listPrice)}
            </p>
          </div>
          <div>
            <p className="text-sm text-black/60 dark:text-white/60">
              What you paid
            </p>
            <p className="mt-1 text-xl font-semibold">
              {currencyFormatter.format(itemDto.purchasePrice)}
            </p>
          </div>
        </div>

        {hasAiReference && (
          <div className="mt-6 rounded-xl border border-black/15 bg-black/[.03] p-5 dark:border-white/20 dark:bg-white/[.04]">
            <h3 className="font-semibold">AI analysis reference</h3>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              A record of the AI suggestions, separate from your prices.
            </p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {itemDto.suggestedPrice !== null && (
                <div>
                  <dt className="text-sm text-black/60 dark:text-white/60">
                    Suggested price
                  </dt>
                  <dd className="mt-1 font-medium">
                    {currencyFormatter.format(itemDto.suggestedPrice)}
                  </dd>
                </div>
              )}
              {itemDto.priceLow !== null && itemDto.priceHigh !== null && (
                <div>
                  <dt className="text-sm text-black/60 dark:text-white/60">
                    Suggested range
                  </dt>
                  <dd className="mt-1 font-medium">
                    {currencyFormatter.format(itemDto.priceLow)}–
                    {currencyFormatter.format(itemDto.priceHigh)}
                  </dd>
                </div>
              )}
              {itemDto.aiConfidence !== null && (
                <div>
                  <dt className="text-sm text-black/60 dark:text-white/60">
                    AI confidence
                  </dt>
                  <dd className="mt-1 font-medium">
                    {itemDto.aiConfidence.replaceAll("_", " ")}
                  </dd>
                </div>
              )}
              {itemDto.priceReasoning !== null && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-black/60 dark:text-white/60">
                    Price reasoning
                  </dt>
                  <dd className="mt-1 whitespace-pre-line">
                    {itemDto.priceReasoning}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </section>

      {itemDto.keywords.length > 0 && (
        <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
          <h2 className="text-lg font-semibold">Keywords</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {itemDto.keywords.map((keyword: string) => (
              <span
                key={keyword}
                className="rounded-full bg-black/[.06] px-3 py-1 text-sm dark:bg-white/10"
              >
                {keyword}
              </span>
            ))}
          </div>
        </section>
      )}

      {itemDto.status === "SOLD" && (
        <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
          <h2 className="text-lg font-semibold">Sale</h2>
          <dl className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-black/60 dark:text-white/60">
                Sold price
              </dt>
              <dd className="mt-1 font-medium">
                {itemDto.soldPrice === null
                  ? "Not recorded"
                  : currencyFormatter.format(itemDto.soldPrice)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-black/60 dark:text-white/60">
                Platform
              </dt>
              <dd className="mt-1 font-medium">
                {itemDto.soldPlatform === null
                  ? "Not recorded"
                  : platformLabels[itemDto.soldPlatform]}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-black/60 dark:text-white/60">
                Sold date
              </dt>
              <dd className="mt-1 font-medium">
                {itemDto.soldDate === null
                  ? "Not recorded"
                  : formatDate(itemDto.soldDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-black/60 dark:text-white/60">
                Platform fees
              </dt>
              <dd className="mt-1 font-medium">
                {itemDto.platformFees === null
                  ? "None recorded"
                  : currencyFormatter.format(itemDto.platformFees)}
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-xl border border-black/15 bg-black/[.03] p-5 dark:border-white/20 dark:bg-white/[.04]">
            <p className="text-sm font-medium text-black/60 dark:text-white/60">
              Profit
            </p>
            <p
              className={`mt-1 text-3xl font-semibold ${
                profit === null
                  ? ""
                  : profit >= 0
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
              }`}
            >
              {profit === null ? "—" : currencyFormatter.format(profit)}
            </p>
            {itemDto.soldPrice !== null && (
              <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                {currencyFormatter.format(itemDto.soldPrice)} sold -{" "}
                {currencyFormatter.format(itemDto.purchasePrice)} paid -{" "}
                {currencyFormatter.format(itemDto.platformFees ?? 0)} fees
              </p>
            )}
            <div className="mt-4">
              <p className="text-sm text-black/60 dark:text-white/60">ROI</p>
              <p className="mt-1 text-xl font-semibold">
                {roi === null ? "—" : `${roi.toFixed(1)}%`}
              </p>
            </div>
          </div>
        </section>
      )}

      <CopyListingSection item={itemDto} />
      <ItemSellSection item={itemDto} />
      <ItemEditSection item={itemDto} />
      <ItemLifecycleSection item={itemDto} />

      {itemDto.notes !== null && (
        <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
          <h2 className="text-lg font-semibold">Private notes</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            For you only. These never appear in a listing.
          </p>
          <p className="mt-4 whitespace-pre-line">{itemDto.notes}</p>
        </section>
      )}
    </main>
  );
}

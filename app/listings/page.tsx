import Link from "next/link";
import type { ItemStatus, Prisma } from "@prisma/client";
import ListingsFilterBar from "@/components/ListingsFilterBar";
import type { ItemDto } from "@/lib/item-dto";
import { toItemDtos } from "@/lib/item-dto";
import { prisma } from "@/lib/db";

// This database-backed page must render fresh on every request, not with stale build-time data.
export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type SortValue = "newest" | "oldest" | "price-high" | "price-low";

function firstSearchParam(
  value: string | string[] | undefined,
): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function isItemStatus(value: string): value is ItemStatus {
  return value === "DRAFT" || value === "LISTED" || value === "SOLD";
}

function isSortValue(value: string): value is SortValue {
  return (
    value === "newest" ||
    value === "oldest" ||
    value === "price-high" ||
    value === "price-low"
  );
}

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

function ListingCard({ item }: { item: ItemDto }) {
  const photo = item.photos[0];
  const status = statusStyles[item.status];
  const metadata = [item.brand, item.size, item.category].filter(
    (value: string | null): value is string => value !== null,
  );
  const createdDate = new Date(item.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="overflow-hidden rounded-xl border border-black/15 dark:border-white/20">
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

      <div className="space-y-3 border-t border-black/10 p-4 dark:border-white/15">
        <div className="flex items-start justify-between gap-3">
          <h2 className="line-clamp-2 font-semibold">{item.title}</h2>
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

        <p className="text-xs text-black/60 dark:text-white/60">
          {createdDate}
        </p>
      </div>
    </div>
  );
}

export default async function ListingsPage(props: {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}) {
  const searchParams = await props.searchParams;
  const statusParam = firstSearchParam(searchParams.status);
  const q = firstSearchParam(searchParams.q).trim();
  const sortParam = firstSearchParam(searchParams.sort);
  const status = isItemStatus(statusParam) ? statusParam : "";
  const sort: SortValue = isSortValue(sortParam) ? sortParam : "newest";

  const where: Prisma.ItemWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  const orderByBySort = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    "price-high": { listPrice: "desc" },
    "price-low": { listPrice: "asc" },
  } satisfies Record<SortValue, Prisma.ItemOrderByWithRelationInput>;

  const [items, totalItems] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: orderByBySort[sort],
    }),
    prisma.item.count(),
  ]);
  const itemDtos = toItemDtos(items);
  const filtersActive = status !== "" || q !== "";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <Link
        href="/"
        className="inline-block text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
      >
        ← Back to home
      </Link>

      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {filtersActive
              ? `${itemDtos.length} of ${totalItems} items`
              : `${itemDtos.length} ${itemDtos.length === 1 ? "item" : "items"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Link
            href="/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            New Listing
          </Link>
          <Link
            href="/analytics"
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            Analytics
          </Link>
        </div>
      </div>

      <ListingsFilterBar status={status} q={q} sort={sort} />

      {totalItems === 0 ? (
        <section className="mt-8 rounded-xl border border-black/15 px-6 py-12 text-center dark:border-white/20">
          <h2 className="text-lg font-semibold">No items yet</h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Add your first item to start building your inventory.
          </p>
          <Link
            href="/new"
            className="mt-5 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Create your first listing
          </Link>
        </section>
      ) : itemDtos.length === 0 ? (
        <section className="mt-8 rounded-xl border border-black/15 px-6 py-12 text-center dark:border-white/20">
          <h2 className="text-lg font-semibold">
            No items match the current filters
          </h2>
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">
            Try changing or clearing your filters.
          </p>
          <Link
            href="/listings"
            className="mt-5 inline-block rounded-md border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
          >
            Clear filters
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {itemDtos.map((item: ItemDto) => (
            <Link
              key={item.id}
              href={`/listings/${item.id}`}
              className="rounded-xl transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.04]"
            >
              <ListingCard item={item} />
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

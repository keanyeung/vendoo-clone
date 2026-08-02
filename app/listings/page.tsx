import Link from "next/link";
import type { Metadata } from "next";
import ListingsFilterBar from "@/components/ListingsFilterBar";
import ListingsTable from "@/components/ListingsTable";
import ListingsViewToggle from "@/components/ListingsViewToggle";
import type { ItemDto } from "@/lib/item-dto";
import { toItemDtos } from "@/lib/item-dto";
import {
  buildListingQuery,
  carryListingContext,
} from "@/lib/listing-context";
import {
  DEFAULT_SORT,
  serializeSort,
  sortItems,
} from "@/lib/listing-sort";
import { STATUS_STYLES } from "@/lib/status-style";
import { prisma } from "@/lib/db";

// This database-backed page must render fresh on every request, not with stale build-time data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listings",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function ListingCard({ item }: { item: ItemDto }) {
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
  const { status, q, sort, view, sortToken, where } =
    buildListingQuery(searchParams);
  // Capture one request-time value so sorting and the hydrated table agree.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const [items, totalItems] = await Promise.all([
    prisma.item.findMany({ where }),
    prisma.item.count(),
  ]);
  const itemDtos = sortItems(toItemDtos(items), sortToken, now);
  const hasActiveFilters =
    status !== "" || q !== "" || sort !== serializeSort(DEFAULT_SORT);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {hasActiveFilters
            ? `${itemDtos.length} of ${totalItems} items`
            : `${itemDtos.length} ${itemDtos.length === 1 ? "item" : "items"}`}
        </p>
      </div>

      <ListingsFilterBar status={status} q={q} sort={sort} view={view} />

      {totalItems > 0 && (
        <div className="mt-6 flex justify-end">
          <ListingsViewToggle
            view={view}
            status={status}
            q={q}
            sort={sort}
          />
        </div>
      )}

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
            href={view === "table" ? "/listings?view=table" : "/listings"}
            className="mt-5 inline-block rounded-md border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
          >
            Clear filters
          </Link>
        </section>
      ) : (
        view === "table" ? (
          <ListingsTable items={itemDtos} now={now} />
        ) : (
          <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {itemDtos.map((item: ItemDto) => (
              <Link
                key={item.id}
                href={carryListingContext(
                  `/listings/${item.id}`,
                  searchParams,
                )}
                className="rounded-xl transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.04]"
              >
                <ListingCard item={item} />
              </Link>
            ))}
          </section>
        )
      )}
    </main>
  );
}

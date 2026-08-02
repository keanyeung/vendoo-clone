import Link from "next/link";
import type { Metadata } from "next";
import ListingsFilterBar from "@/components/ListingsFilterBar";
import ListingsTable from "@/components/ListingsTable";
import ListingsViewToggle from "@/components/ListingsViewToggle";
import ListingsPagination from "@/components/listings/ListingsPagination";
import type { ListingRowDto } from "@/lib/item-dto";
import { toListingRowDtos } from "@/lib/item-dto";
import { ATTENTION_FILTERS } from "@/lib/listing-filters";
import {
  buildListingQuery,
  carryListingContext,
} from "@/lib/listing-context";
import { PAGE_SIZE, paginate } from "@/lib/listing-page";
import { sortItems } from "@/lib/listing-sort";
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

const MAX_SORT_ITEMS = 2000;

function ListingCard({ item }: { item: ListingRowDto }) {
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
  const { status, q, attention, sort, view, page, sortToken, where } =
    buildListingQuery(searchParams);
  // Capture one request-time value so sorting and the hydrated table agree.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const [items, whereFilteredItems, statusGroups] = await Promise.all([
    prisma.item.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        photos: true,
        title: true,
        status: true,
        brand: true,
        size: true,
        category: true,
        listPrice: true,
        purchasePrice: true,
        soldPrice: true,
        soldPlatform: true,
        soldDate: true,
        platformFees: true,
      },
      orderBy: { id: "asc" },
      take: MAX_SORT_ITEMS,
    }),
    prisma.item.count({ where }),
    prisma.item.groupBy({ by: ["status"], _count: true }),
  ]);
  const statusCounts = {
    DRAFT: 0,
    LISTED: 0,
    SOLD: 0,
  };
  for (const group of statusGroups) {
    statusCounts[group.status] = group._count;
  }
  const totalItems =
    statusCounts.DRAFT + statusCounts.LISTED + statusCounts.SOLD;
  const attentionFilter = ATTENTION_FILTERS.find(
    (filter) => filter.key === attention,
  );
  const rowDtos = toListingRowDtos(items);
  const matchingItems = attentionFilter
    ? rowDtos.filter((item) => attentionFilter.matches(item, now))
    : rowDtos;
  const filteredItems = attentionFilter
    ? matchingItems.length
    : whereFilteredItems;
  const sortedItems = sortItems(matchingItems, sortToken, now);
  const paginatedItems = paginate(sortedItems, page);
  const itemDtos = paginatedItems.items;
  const isTruncated = whereFilteredItems > MAX_SORT_ITEMS;
  const firstVisibleItem =
    paginatedItems.total === 0
      ? 0
      : (paginatedItems.page - 1) * PAGE_SIZE + 1;
  const lastVisibleItem =
    itemDtos.length === 0 ? 0 : firstVisibleItem + itemDtos.length - 1;
  const visibleRange =
    itemDtos.length === 0
      ? "Showing 0"
      : `Showing ${firstVisibleItem}-${lastVisibleItem}`;
  const hasListFilters = status !== "" || q !== "" || attention !== "";
  const countLabel =
    hasListFilters
      ? `${visibleRange} of ${filteredItems} - ${totalItems} items total`
      : `${visibleRange} of ${filteredItems} ${filteredItems === 1 ? "item" : "items"}`;
  const listingContext = {
    status,
    q,
    attention,
    sort,
    view,
    page: paginatedItems.page,
  };
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Listings</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {countLabel}
        </p>
      </div>

      <ListingsFilterBar
        status={status}
        q={q}
        attention={attention}
        sort={sort}
        view={view}
        statusCounts={statusCounts}
      />

      {totalItems > 0 && (
        <div className="mt-6 flex justify-end">
          <ListingsViewToggle
            view={view}
            status={status}
            q={q}
            attention={attention}
            sort={sort}
          />
        </div>
      )}

      {isTruncated && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
          This view is limited to 2,000 matching items. Refine the filters to
          sort the full result set.
        </p>
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
        <>
          {view === "table" ? (
            <ListingsTable items={itemDtos} now={now} />
          ) : (
            <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {itemDtos.map((item) => (
                <Link
                  key={item.id}
                  href={carryListingContext(
                    `/listings/${item.id}`,
                    listingContext,
                  )}
                  className="rounded-xl transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.04]"
                >
                  <ListingCard item={item} />
                </Link>
              ))}
            </section>
          )}
          <ListingsPagination
            context={listingContext}
            page={paginatedItems.page}
            pageCount={paginatedItems.pageCount}
          />
        </>
      )}
    </main>
  );
}

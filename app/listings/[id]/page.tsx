import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CopyListingSection } from "@/components/CopyListingSection";
import { ItemActionBar } from "@/components/item/ItemActionBar";
import { ItemDetailProvider } from "@/components/item/ItemDetailProvider";
import { ItemGallery } from "@/components/item/ItemGallery";
import { ItemSaleController } from "@/components/item/ItemSaleController";
import { ListingSavedToast } from "@/components/item/ListingSavedToast";
import { PricePanel } from "@/components/item/PricePanel";
import { SaleSummary } from "@/components/item/SaleSummary";
import { prisma } from "@/lib/db";
import { toItemDto } from "@/lib/item-dto";
import {
  buildListingQuery,
  buildListingsHref,
} from "@/lib/listing-context";
import { sortItems } from "@/lib/listing-sort";
import { getListingBody } from "@/lib/listing-text";

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

function firstSearchParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function listingContextValue(searchParams: {
  [key: string]: string | string[] | undefined;
}): string | null {
  if (!firstSearchParam(searchParams.from)) return null;

  const listingsHref = buildListingsHref(searchParams);
  const separatorIndex = listingsHref.indexOf("?");
  return separatorIndex === -1 ? null : listingsHref.slice(separatorIndex + 1);
}

export default async function ItemDetailPage(
  props: PageProps<"/listings/[id]">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const from = listingContextValue(searchParams);
  const listingQuery = buildListingQuery(searchParams);
  // Capture one request-time value so every days-listed comparison agrees.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const [item, neighbourRows] = await Promise.all([
    prisma.item.findUnique({ where: { id } }),
    from === null
      ? Promise.resolve(null)
      : prisma.item.findMany({
          where: listingQuery.where,
          // sortItems needs these keys to reproduce every in-memory list sort;
          // no photos, listing content, notes, or AI fields are loaded again.
          select: {
            id: true,
            createdAt: true,
            listPrice: true,
            soldPrice: true,
            soldDate: true,
            status: true,
            title: true,
          },
        }),
  ]);

  if (item === null) {
    notFound();
  }

  const itemDto = toItemDto(item);
  const orderedIds =
    neighbourRows === null
      ? null
      : sortItems(
          neighbourRows.map((row) => ({
            id: row.id,
            createdAt: row.createdAt.toISOString(),
            listPrice: Number(row.listPrice),
            soldPrice: row.soldPrice === null ? null : Number(row.soldPrice),
            soldDate:
              row.soldDate === null ? null : row.soldDate.toISOString(),
            status: row.status,
            title: row.title,
          })),
          listingQuery.sortToken,
          now,
        ).map((row) => row.id);
  const itemIndex = orderedIds?.indexOf(itemDto.id) ?? -1;
  const navigation =
    orderedIds === null
      ? null
      : {
          previousId: itemIndex > 0 ? orderedIds[itemIndex - 1] : null,
          nextId:
            itemIndex >= 0 && itemIndex < orderedIds.length - 1
              ? orderedIds[itemIndex + 1]
              : null,
          position: itemIndex === -1 ? null : itemIndex + 1,
          total: orderedIds.length,
        };
  const listingBody = getListingBody(itemDto);
  const createdDate = formatDate(itemDto.createdAt);
  const updatedDate = formatDate(itemDto.updatedAt);

  return (
    <ItemDetailProvider>
      <ListingSavedToast
        itemId={itemDto.id}
        show={searchParams.saved === "1"}
        from={from}
      />
      <ItemSaleController item={itemDto} />
      <ItemActionBar item={itemDto} from={from} navigation={navigation} />
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start gap-9">
          <div className="min-w-0 max-w-[440px] flex-[1_1_400px]">
            <ItemGallery
              itemId={itemDto.id}
              photos={itemDto.photos}
              title={itemDto.title}
              createdLabel={createdDate}
            />
          </div>

          <div className="min-w-0 flex-[1_1_560px]">
            {itemDto.status === "SOLD" ? (
              <SaleSummary item={itemDto} />
            ) : (
              <PricePanel item={itemDto} />
            )}

            <CopyListingSection item={itemDto} />

            <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
              <h2 className="text-lg font-semibold">Listing content</h2>
              <p className="mt-4 whitespace-pre-line leading-7">
                {listingBody}
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

            {itemDto.notes !== null && (
              <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
                <h2 className="text-lg font-semibold">Private notes</h2>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                  For you only. These never appear in a listing.
                </p>
                <p className="mt-4 whitespace-pre-line">{itemDto.notes}</p>
              </section>
            )}

            <p className="mt-8 text-xs text-black/60 dark:text-white/60">
              Updated {updatedDate} · Item ID {itemDto.id}
            </p>
          </div>
        </div>
      </main>
    </ItemDetailProvider>
  );
}

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

export default async function ItemDetailPage(
  props: PageProps<"/listings/[id]">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const item = await prisma.item.findUnique({ where: { id } });

  if (item === null) {
    notFound();
  }

  const itemDto = toItemDto(item);
  const createdDate = formatDate(itemDto.createdAt);
  const updatedDate = formatDate(itemDto.updatedAt);

  return (
    <ItemDetailProvider>
      <ListingSavedToast itemId={itemDto.id} show={searchParams.saved === "1"} />
      <ItemSaleController item={itemDto} />
      <ItemActionBar item={itemDto} />
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
              {itemDto.summary !== null && (
                <p className="mt-2 text-black/70 italic dark:text-white/70">
                  {itemDto.summary}
                </p>
              )}
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

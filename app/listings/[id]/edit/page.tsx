import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EditListingForm } from "@/components/item/EditListingForm";
import { prisma } from "@/lib/db";
import { toItemDto } from "@/lib/item-dto";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: PageProps<"/listings/[id]/edit">,
): Promise<Metadata> {
  const { id } = await props.params;
  const item = await prisma.item.findUnique({
    where: { id },
    select: { title: true },
  });

  return { title: item === null ? "Item not found" : `Edit ${item.title}` };
}

export default async function EditListingPage(
  props: PageProps<"/listings/[id]/edit">,
) {
  const { id } = await props.params;
  const item = await prisma.item.findUnique({ where: { id } });

  if (item === null) notFound();

  return <EditListingForm item={toItemDto(item)} />;
}

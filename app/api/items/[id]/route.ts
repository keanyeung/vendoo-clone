import { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

import { isAuthenticated } from "@/lib/auth";
import { cleanupUnreferencedItemPhotos } from "@/lib/item-cleanup";
import { prisma } from "@/lib/db";
import {
  CreateItemSchema,
  formatZodIssues,
  ItemMutationSchema,
  type ItemMutationInput,
} from "@/lib/item-schema";
import { getRemovedPhotoUrls, isAppPhotoUrl } from "@/lib/photos";
import { deletePhoto } from "@/lib/storage";

export const runtime = "nodejs";

function formatFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "_form");
    fields[field] ??= issue.message;
  }

  return fields;
}

async function cleanupRemovedPhotos(
  originalPhotos: string[],
  updatedPhotos: string[],
): Promise<void> {
  const removedPhotoUrls = getRemovedPhotoUrls(originalPhotos, updatedPhotos);

  for (const photoUrl of removedPhotoUrls) {
    try {
      const isStillReferenced =
        (await prisma.item.count({
          where: { photos: { has: photoUrl } },
        })) > 0;
      if (!isStillReferenced) await deletePhoto(photoUrl);
    } catch {
      // The item update is authoritative. Failed object cleanup can be retried later.
    }
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/items/[id]">,
): Promise<Response> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = ItemMutationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: formatZodIssues(parsed.error) },
      { status: 400 },
    );
  }

  const mutation: ItemMutationInput = parsed.data;

  const updatedPhotos =
    mutation.action === "update" || mutation.action === "apply_analysis"
      ? mutation.data.photos
      : mutation.action === "update_draft"
        ? mutation.data.photos
        : undefined;

  if (updatedPhotos !== undefined) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return Response.json(
        {
          error:
            "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL",
        },
        { status: 500 },
      );
    }

    const storageBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "item-photos";
    if (
      updatedPhotos.some(
        (photoUrl: string): boolean =>
          !isAppPhotoUrl(photoUrl, supabaseUrl, storageBucket),
      )
    ) {
      return Response.json(
        { error: "A photo URL is not from the app's own storage." },
        { status: 400 },
      );
    }
  }

  try {
    switch (mutation.action) {
      case "update":
      case "apply_analysis": {
        const originalPhotos =
          mutation.data.photos === undefined
            ? null
            : await prisma.item.findUnique({
                where: { id },
                select: { photos: true },
              });

        if (mutation.data.photos !== undefined && originalPhotos === null) {
          return Response.json(
            { error: "Item not found." },
            { status: 404 },
          );
        }

        await prisma.item.update({
          where: { id },
          data: {
            ...(mutation.data.photos === undefined
              ? {}
              : { photos: mutation.data.photos }),
            title: mutation.data.title,
            summary: mutation.data.summary,
            description: mutation.data.description,
            brand: mutation.data.brand,
            category: mutation.data.category,
            size: mutation.data.size,
            color: mutation.data.color,
            condition: mutation.data.condition,
            conditionNotes: mutation.data.conditionNotes,
            listPrice: mutation.data.listPrice,
            purchasePrice: mutation.data.purchasePrice,
            keywords: mutation.data.keywords,
            purchaseDate:
              mutation.data.purchaseDate === null
                ? null
                : new Date(mutation.data.purchaseDate),
            notes: mutation.data.notes,
            ...(mutation.action === "apply_analysis"
              ? {
                  suggestedPrice: mutation.data.suggestedPrice,
                  priceLow: mutation.data.priceLow,
                  priceHigh: mutation.data.priceHigh,
                  priceReasoning: mutation.data.priceReasoning,
                  aiConfidence: mutation.data.aiConfidence,
                }
              : {}),
          },
          select: { id: true },
        });

        if (mutation.data.photos !== undefined && originalPhotos !== null) {
          await cleanupRemovedPhotos(
            originalPhotos.photos,
            mutation.data.photos,
          );
        }
        break;
      }
      case "update_draft": {
        const item = await prisma.item.findUnique({
          where: { id },
          select: { status: true, photos: true },
        });
        if (item === null) {
          return Response.json(
            { error: "Item not found." },
            { status: 404 },
          );
        }
        if (item.status !== "DRAFT") {
          return Response.json(
            { error: "Only draft items can be updated with update_draft." },
            { status: 409 },
          );
        }

        const updated = await prisma.item.updateMany({
          where: { id, status: "DRAFT" },
          data: {
            photos: mutation.data.photos,
            title: mutation.data.title,
            summary: mutation.data.summary,
            description: mutation.data.description,
            brand: mutation.data.brand,
            category: mutation.data.category,
            size: mutation.data.size,
            color: mutation.data.color,
            condition: mutation.data.condition,
            conditionNotes: mutation.data.conditionNotes,
            suggestedPrice: mutation.data.suggestedPrice,
            priceLow: mutation.data.priceLow,
            priceHigh: mutation.data.priceHigh,
            priceReasoning: mutation.data.priceReasoning,
            listPrice: mutation.data.listPrice ?? 0,
            purchasePrice: mutation.data.purchasePrice ?? 0,
            keywords: mutation.data.keywords,
            aiConfidence: mutation.data.aiConfidence,
            purchaseDate:
              mutation.data.purchaseDate === null
                ? null
                : new Date(mutation.data.purchaseDate),
            notes: mutation.data.notes,
            ...(mutation.data.draftStep === undefined
              ? {}
              : { draftStep: mutation.data.draftStep }),
          },
        });

        if (updated.count === 0) {
          return Response.json(
            {
              error:
                "This item is no longer a draft, so its draft changes were not saved.",
            },
            { status: 409 },
          );
        }

        await cleanupRemovedPhotos(item.photos, mutation.data.photos);
        break;
      }
      case "patch_fields": {
        await prisma.item.update({
          where: { id },
          data: mutation.data,
          select: { id: true },
        });
        break;
      }
      case "mark_sold": {
        const item = await prisma.item.findUnique({
          where: { id },
          select: { status: true },
        });
        if (item === null) {
          return Response.json(
            { error: "Item not found." },
            { status: 404 },
          );
        }
        if (item.status === "SOLD") {
          return Response.json(
            {
              error:
                "This item is already marked sold. Use edit_sale to change the recorded sale.",
            },
            { status: 409 },
          );
        }

        await prisma.$transaction([
          prisma.item.update({
            where: { id },
            data: {
              soldPrice: mutation.data.soldPrice,
              soldPlatform: mutation.data.soldPlatform,
              soldDate: new Date(mutation.data.soldDate),
              platformFees: mutation.data.platformFees,
              shippingCost: mutation.data.shippingCost,
              status: "SOLD",
            },
            select: { id: true },
          }),
          prisma.itemPosting.upsert({
            where: {
              itemId_platform: {
                itemId: id,
                platform: mutation.data.soldPlatform,
              },
            },
            create: {
              itemId: id,
              platform: mutation.data.soldPlatform,
            },
            update: {
              postedAt: new Date(),
              removedAt: null,
            },
          }),
        ]);
        break;
      }
      case "edit_sale": {
        const item = await prisma.item.findUnique({
          where: { id },
          select: { status: true },
        });
        if (item === null) {
          return Response.json(
            { error: "Item not found." },
            { status: 404 },
          );
        }
        if (item.status !== "SOLD") {
          return Response.json(
            { error: "This item is not marked sold yet." },
            { status: 409 },
          );
        }

        await prisma.item.update({
          where: { id },
          data: {
            soldPrice: mutation.data.soldPrice,
            soldPlatform: mutation.data.soldPlatform,
            soldDate: new Date(mutation.data.soldDate),
            platformFees: mutation.data.platformFees,
            shippingCost: mutation.data.shippingCost,
          },
          select: { id: true },
        });
        break;
      }
      case "set_status": {
        const item = await prisma.item.findUnique({
          where: { id },
        });
        if (item === null) {
          return Response.json(
            { error: "Item not found." },
            { status: 404 },
          );
        }

        if (item.status === "DRAFT" && mutation.data.status === "LISTED") {
          const purchasePrice = Number(item.purchasePrice);
          const strictItem = CreateItemSchema.safeParse({
            photos: item.photos,
            title: item.title,
            summary: item.summary,
            description: item.description,
            brand: item.brand,
            category: item.category,
            size: item.size,
            color: item.color,
            condition: item.condition,
            conditionNotes: item.conditionNotes,
            suggestedPrice:
              item.suggestedPrice === null
                ? null
                : Number(item.suggestedPrice),
            priceLow:
              item.priceLow === null ? null : Number(item.priceLow),
            priceHigh:
              item.priceHigh === null ? null : Number(item.priceHigh),
            priceReasoning: item.priceReasoning,
            listPrice: Number(item.listPrice),
            // Drafts use zero when the non-null database column has not been
            // filled in. Treat that sentinel as missing at the strict gate.
            purchasePrice: purchasePrice === 0 ? undefined : purchasePrice,
            keywords: item.keywords,
            aiConfidence: item.aiConfidence,
            purchaseDate: item.purchaseDate?.toISOString() ?? null,
            notes: item.notes,
            status: "LISTED",
          });

          if (!strictItem.success) {
            return Response.json(
              {
                error:
                  "Complete the required draft fields before listing this item.",
                fields: formatFieldErrors(strictItem.error),
              },
              { status: 400 },
            );
          }
        }

        await prisma.item.update({
          where: { id },
          data: {
            status: mutation.data.status,
            ...(item.status === "SOLD"
              ? {
                  soldPrice: null,
                  soldPlatform: null,
                  soldDate: null,
                  platformFees: null,
                  shippingCost: null,
                }
              : {}),
          },
          select: { id: true },
        });
        break;
      }
      default: {
        const exhaustive: never = mutation;
        throw new Error(`Unhandled item mutation: ${String(exhaustive)}`);
      }
    }

    return Response.json({ id }, { status: 200 });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return Response.json(
        { error: "Item not found." },
        { status: 404 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown database error.";
    return Response.json(
      { error: `Failed to update item: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/items/[id]">,
): Promise<Response> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let photos: string[];

  try {
    const item = await prisma.item.findUnique({
      where: { id },
      select: { photos: true },
    });
    if (item === null) {
      return Response.json(
        { error: "Item not found." },
        { status: 404 },
      );
    }

    photos = item.photos;
    await prisma.item.delete({ where: { id } });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";
    return Response.json(
      { error: `Failed to delete item: ${message}` },
      { status: 500 },
    );
  }

  await cleanupUnreferencedItemPhotos(photos);

  return Response.json({ ok: true });
}

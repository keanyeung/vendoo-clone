import { Prisma } from "@prisma/client";

import { isAuthenticated } from "@/lib/auth";
import { cleanupUnreferencedItemPhotos } from "@/lib/item-cleanup";
import { prisma } from "@/lib/db";
import {
  formatZodIssues,
  ItemMutationSchema,
  type ItemMutationInput,
} from "@/lib/item-schema";
import { getRemovedPhotoUrls, isAppPhotoUrl } from "@/lib/photos";
import { deletePhoto } from "@/lib/storage";

export const runtime = "nodejs";

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

  if (mutation.action === "update" && mutation.data.photos !== undefined) {
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
      mutation.data.photos.some(
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
      case "update": {
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
          },
          select: { id: true },
        });

        if (mutation.data.photos !== undefined && originalPhotos !== null) {
          const removedPhotoUrls = getRemovedPhotoUrls(
            originalPhotos.photos,
            mutation.data.photos,
          );

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

        await prisma.item.update({
          where: { id },
          data: {
            soldPrice: mutation.data.soldPrice,
            soldPlatform: mutation.data.soldPlatform,
            soldDate: new Date(mutation.data.soldDate),
            platformFees: mutation.data.platformFees,
            status: "SOLD",
          },
          select: { id: true },
        });
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
          },
          select: { id: true },
        });
        break;
      }
      case "set_status": {
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

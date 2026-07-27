import { Prisma } from "@prisma/client";

import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatZodIssues,
  ItemMutationSchema,
  type ItemMutationInput,
} from "@/lib/item-schema";
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

  try {
    switch (mutation.action) {
      case "update":
        await prisma.item.update({
          where: { id },
          data: {
            title: mutation.data.title,
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
        break;
      case "mark_sold":
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

  // The row is the source of truth; a storage orphan is preferable to reporting failure after deletion.
  for (const photoUrl of photos) {
    try {
      await deletePhoto(photoUrl);
    } catch {
      // Photo cleanup is best-effort so one failure does not prevent the remaining deletions.
    }
  }

  return Response.json({ ok: true });
}

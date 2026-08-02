import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cleanupUnreferencedItemPhotos } from "@/lib/item-cleanup";
import {
  BulkItemMutationSchema,
  formatZodIssues,
  type BulkItemMutationInput,
} from "@/lib/item-schema";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = BulkItemMutationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: formatZodIssues(parsed.error) },
      { status: 400 },
    );
  }

  const mutation: BulkItemMutationInput = parsed.data;

  try {
    switch (mutation.action) {
      case "set_status": {
        // The single-item set_status path clears the sale record when an item
        // leaves SOLD. Bulk must match it: a relisted item that keeps its
        // soldDate freezes daysListed at the old sale, which then misreports
        // the Days listed column and the aging filter.
        const soldItems = await prisma.item.findMany({
          where: { id: { in: mutation.ids }, status: "SOLD" },
          select: { id: true },
        });
        const soldIds = soldItems.map((item): string => item.id);
        const soldIdSet = new Set(soldIds);
        const unsoldIds = mutation.ids.filter(
          (id: string): boolean => !soldIdSet.has(id),
        );

        const [clearedSales, plainUpdates] = await Promise.all([
          soldIds.length === 0
            ? { count: 0 }
            : prisma.item.updateMany({
                where: { id: { in: soldIds } },
                data: {
                  status: mutation.data.status,
                  soldPrice: null,
                  soldPlatform: null,
                  soldDate: null,
                  platformFees: null,
                },
              }),
          unsoldIds.length === 0
            ? { count: 0 }
            : prisma.item.updateMany({
                where: { id: { in: unsoldIds } },
                data: { status: mutation.data.status },
              }),
        ]);

        return Response.json(
          { count: clearedSales.count + plainUpdates.count },
          { status: 200 },
        );
      }
      case "delete": {
        const items = await prisma.item.findMany({
          where: { id: { in: mutation.ids } },
          select: { photos: true },
        });
        const result = await prisma.item.deleteMany({
          where: { id: { in: mutation.ids } },
        });

        await cleanupUnreferencedItemPhotos(
          items.flatMap((item) => item.photos),
        );

        return Response.json({ count: result.count }, { status: 200 });
      }
      default: {
        const exhaustive: never = mutation;
        throw new Error(`Unhandled bulk mutation: ${String(exhaustive)}`);
      }
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";
    return Response.json(
      { error: `Bulk action failed: ${message}` },
      { status: 500 },
    );
  }
}

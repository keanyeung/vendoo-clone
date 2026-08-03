import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildDuplicateTitle } from "@/lib/item-schema";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/items/[id]/duplicate">,
): Promise<Response> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const source = await prisma.item.findUnique({
      where: { id },
      select: {
        photos: true,
        title: true,
        summary: true,
        description: true,
        brand: true,
        category: true,
        size: true,
        color: true,
        condition: true,
        conditionNotes: true,
        suggestedPrice: true,
        priceLow: true,
        priceHigh: true,
        priceReasoning: true,
        listPrice: true,
        purchasePrice: true,
        keywords: true,
        aiConfidence: true,
      },
    });
    if (source === null) {
      return Response.json({ error: "Item not found." }, { status: 404 });
    }

    const duplicate = await prisma.item.create({
      data: {
        photos: source.photos,
        title: buildDuplicateTitle(source.title),
        summary: source.summary,
        description: source.description,
        brand: source.brand,
        category: source.category,
        size: source.size,
        color: source.color,
        condition: source.condition,
        conditionNotes: source.conditionNotes,
        suggestedPrice: source.suggestedPrice,
        priceLow: source.priceLow,
        priceHigh: source.priceHigh,
        priceReasoning: source.priceReasoning,
        listPrice: source.listPrice,
        purchasePrice: source.purchasePrice,
        keywords: source.keywords,
        aiConfidence: source.aiConfidence,
        status: "DRAFT",
        draftStep: "reviewed",
      },
      select: { id: true },
    });

    return Response.json({ id: duplicate.id }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";
    return Response.json(
      { error: `Failed to duplicate item: ${message}` },
      { status: 500 },
    );
  }
}

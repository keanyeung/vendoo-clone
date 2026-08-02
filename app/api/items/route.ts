import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  CreateItemSchema,
  DraftItemSchema,
  formatZodIssues,
} from "@/lib/item-schema";
import { isAppPhotoUrl } from "@/lib/photos";

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

  const isDraftRequest =
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    body.status === "DRAFT";
  const parsed = isDraftRequest
    ? DraftItemSchema.safeParse(body)
    : CreateItemSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: formatZodIssues(parsed.error) },
      { status: 400 },
    );
  }

  const data = parsed.data;
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

  for (const photoUrl of data.photos) {
    if (!isAppPhotoUrl(photoUrl, supabaseUrl, storageBucket)) {
      return Response.json(
        { error: "A photo URL is not from the app's own storage." },
        { status: 400 },
      );
    }
  }

  try {
    const item = await prisma.item.create({
      data: {
        photos: data.photos,
        title: data.title,
        summary: data.summary,
        description: data.description,
        brand: data.brand,
        category: data.category,
        size: data.size,
        color: data.color,
        condition: data.condition,
        conditionNotes: data.conditionNotes,
        suggestedPrice: data.suggestedPrice,
        priceLow: data.priceLow,
        priceHigh: data.priceHigh,
        priceReasoning: data.priceReasoning,
        // Price columns predate server drafts and remain non-nullable. Zero is
        // the storage sentinel for a value the draft has not collected yet.
        listPrice: data.listPrice ?? 0,
        purchasePrice: data.purchasePrice ?? 0,
        keywords: data.keywords,
        aiConfidence: data.aiConfidence,
        purchaseDate:
          data.purchaseDate === null ? null : new Date(data.purchaseDate),
        notes: data.notes,
        status: data.status,
        draftStep: "draftStep" in data ? data.draftStep : undefined,
      },
      select: { id: true },
    });

    return Response.json({ id: item.id }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";
    return Response.json(
      { error: `Failed to create item: ${message}` },
      { status: 500 },
    );
  }
}

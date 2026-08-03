import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatZodIssues,
  RemoveItemPostingSchema,
  UpsertItemPostingSchema,
} from "@/lib/item-schema";
import { toItemPostingDto } from "@/lib/item-dto";

export const runtime = "nodejs";

async function itemExists(id: string): Promise<boolean> {
  return (
    (await prisma.item.findUnique({
      where: { id },
      select: { id: true },
    })) !== null
  );
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/items/[id]/postings">,
): Promise<Response> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(request);
  if (body === undefined) {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = UpsertItemPostingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: formatZodIssues(parsed.error) },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  try {
    if (!(await itemExists(id))) {
      return Response.json({ error: "Item not found." }, { status: 404 });
    }

    const posting = await prisma.itemPosting.upsert({
      where: {
        itemId_platform: {
          itemId: id,
          platform: parsed.data.platform,
        },
      },
      create: {
        itemId: id,
        platform: parsed.data.platform,
        url: parsed.data.url ?? null,
      },
      update: {
        postedAt: new Date(),
        removedAt: null,
        ...(parsed.data.url === undefined ? {} : { url: parsed.data.url }),
      },
    });

    return Response.json({ posting: toItemPostingDto(posting) });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";
    return Response.json(
      { error: `Failed to record posting: ${message}` },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/items/[id]/postings">,
): Promise<Response> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson(request);
  if (body === undefined) {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = RemoveItemPostingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: formatZodIssues(parsed.error) },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  try {
    if (!(await itemExists(id))) {
      return Response.json({ error: "Item not found." }, { status: 404 });
    }

    const result = await prisma.itemPosting.updateMany({
      where: { itemId: id, platform: parsed.data.platform },
      data: { removedAt: new Date() },
    });

    return Response.json({ removed: result.count > 0 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown database error.";
    return Response.json(
      { error: `Failed to remove posting: ${message}` },
      { status: 500 },
    );
  }
}

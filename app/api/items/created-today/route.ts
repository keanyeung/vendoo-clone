import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const MAX_DAY_WINDOW_MS = 26 * 60 * 60 * 1000;

export async function GET(request: Request): Promise<Response> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const start = new Date(url.searchParams.get("start") ?? "");
  const end = new Date(url.searchParams.get("end") ?? "");
  const startMs = start.getTime();
  const endMs = end.getTime();

  if (
    Number.isNaN(startMs) ||
    Number.isNaN(endMs) ||
    endMs <= startMs ||
    endMs - startMs > MAX_DAY_WINDOW_MS
  ) {
    return Response.json(
      { error: "A valid local-day start and end are required." },
      { status: 400 },
    );
  }

  const count = await prisma.item.count({
    where: {
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });

  return Response.json({ count });
}

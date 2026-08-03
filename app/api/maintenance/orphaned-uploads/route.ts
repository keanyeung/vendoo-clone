import { isAuthenticated } from "@/lib/auth";
import { sweepOrphanedUploads } from "@/lib/orphaned-uploads";

export const runtime = "nodejs";

type DeleteFlagResult =
  | { deleteOrphans: boolean; error?: never }
  | { deleteOrphans?: never; error: string };

async function readDeleteFlag(request: Request): Promise<DeleteFlagResult> {
  const rawBody = await request.text();
  if (rawBody.trim() === "") return { deleteOrphans: false };

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { error: "Invalid JSON body." };
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const deleteFlag = (body as Record<string, unknown>).delete;
  if (deleteFlag !== undefined && typeof deleteFlag !== "boolean") {
    return { error: "delete must be a boolean when provided." };
  }

  return { deleteOrphans: deleteFlag === true };
}

export async function POST(request: Request): Promise<Response> {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleteFlag = await readDeleteFlag(request);
  if (deleteFlag.error !== undefined) {
    return Response.json({ error: deleteFlag.error }, { status: 400 });
  }

  try {
    const result = await sweepOrphanedUploads({
      deleteOrphans: deleteFlag.deleteOrphans,
    });
    return Response.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Orphaned upload sweep failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

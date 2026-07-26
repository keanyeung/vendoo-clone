import { analyzeItemPhotos } from "@/lib/anthropic";
import { isAuthenticated } from "@/lib/auth";
import { MAX_FILES } from "@/lib/upload-limits";

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

  if (
    typeof body !== "object" ||
    body === null ||
    !("photoUrls" in body) ||
    !Array.isArray(body.photoUrls) ||
    !body.photoUrls.every((entry: unknown): entry is string =>
      typeof entry === "string"
    )
  ) {
    return Response.json(
      { error: "photoUrls must be an array of strings." },
      { status: 400 },
    );
  }

  const photoUrls: string[] = body.photoUrls;

  if (photoUrls.length === 0) {
    return Response.json(
      { error: "At least one photo URL is required." },
      { status: 400 },
    );
  }

  if (photoUrls.length > MAX_FILES) {
    return Response.json(
      { error: `A maximum of ${MAX_FILES} photo URLs can be analyzed at once.` },
      { status: 400 },
    );
  }

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

  const allowedPublicPrefix = `${supabaseUrl}/storage/v1/object/public/`;

  for (const photoUrl of photoUrls) {
    try {
      new URL(photoUrl);
    } catch {
      return Response.json(
        { error: "A photo URL is malformed." },
        { status: 400 },
      );
    }

    if (!photoUrl.startsWith(allowedPublicPrefix)) {
      return Response.json(
        { error: "A photo URL is not from the app's own storage." },
        { status: 400 },
      );
    }
  }

  try {
    const { analysis, usage } = await analyzeItemPhotos(photoUrls);
    return Response.json({ analysis, usage });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "AI analysis failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}

import { isAuthenticated } from "@/lib/auth";
import {
  isAllowedMimeType,
  MAX_FILE_BYTES,
  MAX_FILES,
  uploadPhoto,
} from "@/lib/storage";
import { deletePhoto } from "@/lib/storage";

export const runtime = "nodejs";

function formatMegabytes(bytes: number): string {
  const megabytes = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return `${megabytes} MB`;
}

export async function POST(request: Request): Promise<Response> {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Invalid multipart form data." },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return Response.json(
      { error: "At least one file is required." },
      { status: 400 },
    );
  }

  if (files.length > MAX_FILES) {
    return Response.json(
      { error: `A maximum of ${MAX_FILES} files can be uploaded at once.` },
      { status: 400 },
    );
  }

  for (const file of files) {
    if (!isAllowedMimeType(file.type)) {
      return Response.json(
        {
          error: `File "${file.name}" has an unsupported type (${file.type || "unknown"}).`,
        },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return Response.json(
        { error: `File "${file.name}" is empty.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return Response.json(
        {
          error: `File "${file.name}" exceeds the ${formatMegabytes(MAX_FILE_BYTES)} size limit.`,
        },
        { status: 400 },
      );
    }
  }

  try {
    const urls: string[] = await Promise.all(
      files.map(async (file): Promise<string> => {
        const bytes = await file.arrayBuffer();
        return uploadPhoto(bytes, file.type);
      }),
    );

    return Response.json({ urls });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Photo upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
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
    !("url" in body) ||
    typeof body.url !== "string"
  ) {
    return Response.json(
      { error: "url must be a string." },
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
  if (!body.url.startsWith(allowedPublicPrefix)) {
    return Response.json(
      { error: "A photo URL is not from the app's own storage." },
      { status: 400 },
    );
  }

  try {
    await deletePhoto(body.url);
    return Response.json({ ok: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Photo deletion failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

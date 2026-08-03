import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
} from "@/lib/upload-limits";
import { getAppPhotoObjectPath } from "@/lib/photos";

export {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_FILES,
  isAllowedMimeType,
} from "@/lib/upload-limits";
export type { AllowedMimeType } from "@/lib/upload-limits";

let supabase: SupabaseClient | undefined;
const STORAGE_LIST_PAGE_SIZE = 100;

export type StoredPhotoObject = {
  objectPath: string;
  publicUrl: string;
  createdAt: string | null;
};

function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  supabase = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabase;
}

export async function uploadPhoto(
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  if (!isAllowedMimeType(contentType)) {
    throw new Error(`Unsupported image MIME type: ${contentType}`);
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "item-photos";
  const path = `${randomUUID()}.${ALLOWED_MIME_TYPES[contentType]}`;
  const client = getSupabaseClient();
  const { error } = await client.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(`Supabase photo upload failed: ${error.message}`);
  }

  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function deletePhoto(publicUrl: string): Promise<void> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "item-photos";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  const objectPath = getAppPhotoObjectPath(publicUrl, supabaseUrl, bucket);
  if (objectPath === null) {
    throw new Error("The URL is not a photo in this app's storage bucket.");
  }
  const client = getSupabaseClient();

  // Supabase treats a missing object as a no-op, so repeated deletion is safe.
  const { error } = await client.storage.from(bucket).remove([objectPath]);

  if (error) {
    throw new Error(`Supabase photo deletion failed: ${error.message}`);
  }
}

async function listStoredPhotosInFolder(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<StoredPhotoObject[]> {
  const photos: StoredPhotoObject[] = [];
  let offset = 0;

  while (true) {
    const bucketClient = client.storage.from(bucket);
    const { data, error } = await bucketClient.list(prefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      throw new Error(`Supabase photo listing failed: ${error.message}`);
    }

    for (const entry of data) {
      if (entry.name === "") continue;

      const objectPath = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.id === null) {
        photos.push(
          ...(await listStoredPhotosInFolder(client, bucket, objectPath)),
        );
        continue;
      }

      photos.push({
        objectPath,
        publicUrl: bucketClient.getPublicUrl(objectPath).data.publicUrl,
        createdAt: entry.created_at,
      });
    }

    if (data.length < STORAGE_LIST_PAGE_SIZE) break;
    offset += data.length;
  }

  return photos;
}

export async function listStoredPhotos(): Promise<StoredPhotoObject[]> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "item-photos";
  return listStoredPhotosInFolder(getSupabaseClient(), bucket, "");
}

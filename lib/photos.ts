export const ORPHANED_UPLOAD_MIN_AGE_MS = 24 * 60 * 60 * 1000;

export function isPhotoObjectOlderThanMinimum(
  createdAt: string | null,
  now: Date,
): boolean {
  if (createdAt === null) return false;

  const createdAtMs = Date.parse(createdAt);
  return (
    Number.isFinite(createdAtMs) &&
    createdAtMs < now.getTime() - ORPHANED_UPLOAD_MIN_AGE_MS
  );
}

export function getAppPhotoObjectPath(
  publicUrl: string,
  supabaseUrl: string,
  bucket: string,
): string | null {
  try {
    const candidate = new URL(publicUrl);
    const storageOrigin = new URL(supabaseUrl);
    const publicPathPrefix = `/storage/v1/object/public/${encodeURIComponent(bucket)}/`;

    if (
      candidate.origin !== storageOrigin.origin ||
      candidate.username !== "" ||
      candidate.password !== "" ||
      candidate.search !== "" ||
      candidate.hash !== "" ||
      !candidate.pathname.startsWith(publicPathPrefix)
    ) {
      return null;
    }

    const encodedObjectPath = candidate.pathname.slice(publicPathPrefix.length);
    if (encodedObjectPath === "") return null;

    const objectPath = decodeURIComponent(encodedObjectPath);
    return objectPath.startsWith("/") ? null : objectPath;
  } catch {
    return null;
  }
}

export function isAppPhotoUrl(
  publicUrl: string,
  supabaseUrl: string,
  bucket: string,
): boolean {
  return getAppPhotoObjectPath(publicUrl, supabaseUrl, bucket) !== null;
}

export function getRemovedPhotoUrls(
  originalUrls: string[],
  nextUrls: string[],
): string[] {
  const retainedUrls = new Set(nextUrls);
  return originalUrls.filter((url: string): boolean => !retainedUrls.has(url));
}

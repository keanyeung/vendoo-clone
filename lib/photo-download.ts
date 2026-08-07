// Browser-side saving helpers shared by the single-photo and zip downloads.
//
// Photos are served from Supabase storage, a different origin, and an anchor's
// `download` attribute is ignored cross-origin - the browser would navigate to
// the image instead of saving it. Fetching the bytes and saving an object URL
// is what actually produces a download with the filename we choose.

export async function fetchPhotoBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Photo request failed with ${response.status}`);
  }
  return response.blob();
}

export async function fetchPhotoBytes(
  url: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Photo request failed with ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export function saveBlob(filename: string, blob: Blob): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export async function downloadPhoto(
  url: string,
  filename: string,
): Promise<void> {
  saveBlob(filename, await fetchPhotoBlob(url));
}

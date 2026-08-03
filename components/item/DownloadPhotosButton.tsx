"use client";

import { useState } from "react";

import { buildPhotoArchive } from "@/lib/photo-archive";

type DownloadPhotosButtonProps = {
  title: string;
  photoUrls: string[];
  className?: string;
};

async function fetchPhoto(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Photo request failed with ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function saveZip(filename: string, bytes: Uint8Array<ArrayBuffer>): void {
  const blob = new Blob([bytes], { type: "application/zip" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function DownloadPhotosButton({
  title,
  photoUrls,
  className = "",
}: DownloadPhotosButtonProps) {
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (photoUrls.length === 0) return null;

  async function download(): Promise<void> {
    setError(null);
    setIsSaving(true);
    try {
      const photos = await Promise.all(
        photoUrls.map(async (url: string) => ({
          url,
          data: await fetchPhoto(url),
        })),
      );
      const archive = buildPhotoArchive(title, photos, new Date());
      saveZip(archive.filename, archive.bytes);
    } catch {
      setError("Could not download the photos. Check your connection and retry.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void download()}
        disabled={isSaving}
        aria-label="Download all photos"
        className="inline-flex min-h-11 shrink-0 items-center font-medium hover:text-black disabled:opacity-50 dark:hover:text-white"
      >
        {isSaving ? "Preparing…" : "Download photos"}
      </button>
      {error !== null && (
        <p role="alert" className="mt-1 text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

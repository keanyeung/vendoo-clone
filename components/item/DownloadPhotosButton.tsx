"use client";

import { useState } from "react";

import { buildPhotoArchive } from "@/lib/photo-archive";
import { fetchPhotoBytes, saveBlob } from "@/lib/photo-download";

type DownloadPhotosButtonProps = {
  title: string;
  photoUrls: string[];
  className?: string;
};

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
          data: await fetchPhotoBytes(url),
        })),
      );
      const archive = buildPhotoArchive(title, photos, new Date());
      saveBlob(
        archive.filename,
        new Blob([archive.bytes], { type: "application/zip" }),
      );
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

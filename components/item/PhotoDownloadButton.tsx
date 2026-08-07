"use client";

import { useState } from "react";

import { downloadPhoto } from "@/lib/photo-download";

type PhotoDownloadButtonProps = {
  url: string;
  filename: string;
  label: string;
  onError: (message: string) => void;
  className?: string;
};

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v7.5" />
      <path d="M4.75 6.75 8 10l3.25-3.25" />
      <path d="M3 12.5h10" />
    </svg>
  );
}

/** Saves one photo. Overlaid on a gallery image, so it stays visually light. */
export function PhotoDownloadButton({
  url,
  filename,
  label,
  onError,
  className = "",
}: PhotoDownloadButtonProps) {
  const [isSaving, setIsSaving] = useState<boolean>(false);

  async function save(): Promise<void> {
    setIsSaving(true);
    try {
      await downloadPhoto(url, filename);
    } catch {
      onError("Could not download that photo. Check your connection and retry.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      type="button"
      // The gallery images sit inside their own buttons, so the click must not
      // also select the thumbnail or open the lightbox.
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void save();
      }}
      disabled={isSaving}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-md bg-black/55 p-1.5 text-white opacity-70 transition-opacity hover:bg-black/75 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40 ${className}`}
    >
      {isSaving ? (
        <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <DownloadIcon />
      )}
    </button>
  );
}

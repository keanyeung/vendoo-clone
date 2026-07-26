"use client";

import Link from "next/link";
import { useState } from "react";
import PhotoUploader from "@/components/PhotoUploader";

export default function NewListingPage() {
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="space-y-2">
        <Link
          href="/"
          className="inline-block text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
        >
          ← Back to home
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New Listing</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Step one: add photos of the item you want to list.
        </p>
      </div>

      <section className="mt-8">
        <PhotoUploader onChange={setUploadedUrls} />
      </section>

      {uploadedUrls.length > 0 && (
        <section className="mt-8 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Uploaded photos</h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              {uploadedUrls.length}{" "}
              {uploadedUrls.length === 1 ? "photo" : "photos"} uploaded
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {uploadedUrls.map((url: string, index: number) => (
              <div
                key={url}
                className="overflow-hidden rounded-xl border border-black/15 dark:border-white/20"
              >
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Uploaded listing photo ${index + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                </a>
                <p
                  title={url}
                  className="select-text truncate border-t border-black/10 p-3 text-xs text-black/60 dark:border-white/15 dark:text-white/60"
                >
                  {url}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

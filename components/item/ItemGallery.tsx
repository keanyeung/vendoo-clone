"use client";

import Image from "next/image";
import Link from "next/link";

import { DownloadPhotosButton } from "@/components/item/DownloadPhotosButton";
import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type ItemGalleryProps = {
  itemId: string;
  photos: string[];
  title: string;
  createdLabel: string;
};

export function ItemGallery({
  itemId,
  photos,
  title,
  createdLabel,
}: ItemGalleryProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const activeIndex = Math.min(
    selectedIndex,
    Math.max(photos.length - 1, 0),
  );
  const activePhoto = photos[activeIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (isLightboxOpen && activePhoto !== undefined && !dialog.open) {
      dialog.showModal();
    } else if ((!isLightboxOpen || activePhoto === undefined) && dialog.open) {
      dialog.close();
    }
  }, [activePhoto, isLightboxOpen]);

  function getNextIndex(key: string): number | null {
    if (key !== "ArrowLeft" && key !== "ArrowRight") return null;

    const nextIndex = activeIndex + (key === "ArrowLeft" ? -1 : 1);
    return nextIndex >= 0 && nextIndex < photos.length ? nextIndex : null;
  }

  function handleThumbnailKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
  ): void {
    const nextIndex = getNextIndex(event.key);
    if (nextIndex === null) return;

    event.preventDefault();
    setSelectedIndex(nextIndex);
    thumbnailRefs.current[nextIndex]?.focus();
  }

  function handleLightboxKeyDown(
    event: KeyboardEvent<HTMLDialogElement>,
  ): void {
    const nextIndex = getNextIndex(event.key);
    if (nextIndex === null) return;

    event.preventDefault();
    setSelectedIndex(nextIndex);
  }

  function closeLightbox(): void {
    setIsLightboxOpen(false);
  }

  if (activePhoto === undefined) {
    return (
      <section className="min-[1044px]:sticky min-[1044px]:top-[132px]">
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-black/15 bg-black/[.04] text-sm text-black/60 dark:border-white/20 dark:bg-white/[.06] dark:text-white/60">
          No photos
        </div>
        <div className="mt-3 flex justify-end">
          <Link
            href={`/listings/${itemId}/edit#photos`}
            className="inline-flex min-h-11 items-center text-xs font-medium text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
          >
            Edit photos
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-[1044px]:sticky min-[1044px]:top-[132px]">
      <button
        type="button"
        onClick={() => setIsLightboxOpen(true)}
        aria-label={`Open ${title}, photo ${activeIndex + 1} of ${photos.length} in full screen`}
        className="relative block aspect-square min-h-11 w-full overflow-hidden rounded-[14px] border border-black/15 bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-white/20 dark:bg-white/[.04]"
      >
        <Image
          src={activePhoto}
          alt={title}
          fill
          sizes="(max-width: 1043px) calc(100vw - 2rem), 440px"
          loading="eager"
          className="object-cover"
        />
      </button>

      {photos.length > 1 && (
        <div
          className="mt-3 grid grid-cols-4 gap-2.5"
          onKeyDown={handleThumbnailKeyDown}
        >
          {photos.map((photoUrl, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={`${photoUrl}-${index}`}
                ref={(element) => {
                  thumbnailRefs.current[index] = element;
                }}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`Show ${title}, photo ${index + 1}`}
                aria-current={isActive ? "true" : undefined}
                className={`relative aspect-square min-h-11 overflow-hidden rounded-lg transition-opacity focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isActive
                    ? "border-2 border-foreground opacity-100"
                    : "border border-black/15 opacity-65 hover:opacity-100 dark:border-white/20"
                }`}
              >
                <Image
                  src={photoUrl}
                  alt={`${title}, photo ${index + 1}`}
                  fill
                  sizes="(max-width: 479px) calc((100vw - 3.875rem) / 4), 100px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 text-xs text-black/60 dark:text-white/60">
        <p>
          {photos.length} {photos.length === 1 ? "photo" : "photos"} · created{" "}
          {createdLabel}
        </p>
        <div className="flex shrink-0 items-center gap-4">
          <DownloadPhotosButton title={title} photoUrls={photos} />
          <Link
            href={`/listings/${itemId}/edit#photos`}
            className="inline-flex min-h-11 shrink-0 items-center font-medium hover:text-black dark:hover:text-white"
          >
            Edit photos
          </Link>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setIsLightboxOpen(false)}
        onKeyDown={handleLightboxKeyDown}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const inside =
            event.clientX >= bounds.left &&
            event.clientX <= bounds.right &&
            event.clientY >= bounds.top &&
            event.clientY <= bounds.bottom;
          if (!inside) closeLightbox();
        }}
        className="item-gallery-dialog m-auto w-[calc(100%-2rem)] max-w-6xl rounded-[14px] border border-black/15 bg-background p-3 text-foreground shadow-2xl dark:border-white/20 sm:p-4"
      >
        <style>{`
          .item-gallery-dialog::backdrop {
            background: rgb(0 0 0 / 0.55);
          }
        `}</style>
        <div className="flex min-h-11 items-center justify-between gap-4">
          <p className="text-sm text-black/60 dark:text-white/60">
            Photo {activeIndex + 1} of {photos.length}
          </p>
          <button
            type="button"
            onClick={closeLightbox}
            className="min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            Close
          </button>
        </div>
        <div className="relative mt-3 h-[calc(100dvh-8rem)] min-h-64 max-h-[85vh] w-full">
          <Image
            src={activePhoto}
            alt={`${title}, photo ${activeIndex + 1} full screen`}
            fill
            sizes="100vw"
            className="object-contain"
          />
        </div>
      </dialog>
    </section>
  );
}

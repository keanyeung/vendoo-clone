"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { UndoToast } from "@/components/UndoToast";
import { compressImage } from "@/lib/compress";
import {
  createDraftPhoto,
  type DraftPhoto,
  type RemovedDraftPhoto,
} from "@/lib/item-edit-draft";
import {
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  MAX_FILE_BYTES,
  MAX_FILES,
} from "@/lib/upload-limits";

type PhotoManagerProps = {
  photos: DraftPhoto[];
  lastRemoval: RemovedDraftPhoto | null;
  disabled?: boolean;
  maxFiles?: number;
  reuploadOnUndo?: boolean;
  onAddPhotos: (photos: DraftPhoto[]) => void;
  onUploadStarted: (photoId: string) => void;
  onUploadSucceeded: (photoId: string, url: string) => void;
  onUploadFailed: (photoId: string, error: string) => void;
  onRemovePhoto: (photoId: string) => void;
  onUndoRemove: () => void;
  onMovePhoto: (photoId: string, toIndex: number) => void;
  onSetCover: (photoId: string) => void;
};

type UploadResponse = {
  urls?: string[];
  error?: string;
};

type Toast = {
  text: string;
  canUndo: boolean;
};

const acceptedTypes = Object.keys(ALLOWED_MIME_TYPES).join(",");

function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function uploadFilename(file: File, blob: Blob): string {
  if (blob.type !== "image/jpeg") return file.name;
  const baseName = file.name.replace(/\.[^/.]+$/, "");
  return `${baseName || "photo"}.jpg`;
}

function parseUploadResponse(value: unknown): UploadResponse {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  return {
    error: typeof record.error === "string" ? record.error : undefined,
    urls:
      Array.isArray(record.urls) &&
      record.urls.every(
        (candidate: unknown): candidate is string =>
          typeof candidate === "string",
      )
        ? record.urls
        : undefined,
  };
}

export function PhotoManager({
  photos,
  lastRemoval,
  disabled = false,
  maxFiles = MAX_FILES,
  reuploadOnUndo = false,
  onAddPhotos,
  onUploadStarted,
  onUploadSucceeded,
  onUploadFailed,
  onRemovePhoto,
  onUndoRemove,
  onMovePhoto,
  onSetCover,
}: PhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileByPhotoIdRef = useRef<Map<string, File>>(new Map());
  const createdPreviewUrlsRef = useRef<Set<string>>(new Set());
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState<string | null>(null);
  const [isFileDragOver, setIsFileDragOver] = useState<boolean>(false);
  const [mobileActionsPhotoId, setMobileActionsPhotoId] = useState<
    string | null
  >(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    const createdPreviewUrls = createdPreviewUrlsRef.current;
    return (): void => {
      for (const previewUrl of createdPreviewUrls) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    const retainedPreviewUrls = new Set(
      photos.map((photo: DraftPhoto): string => photo.previewUrl),
    );
    if (lastRemoval !== null) {
      retainedPreviewUrls.add(lastRemoval.photo.previewUrl);
    }

    for (const previewUrl of createdPreviewUrlsRef.current) {
      if (retainedPreviewUrls.has(previewUrl)) continue;
      URL.revokeObjectURL(previewUrl);
      createdPreviewUrlsRef.current.delete(previewUrl);
    }
  }, [lastRemoval, photos]);

  function showToast(nextToast: Toast): void {
    setToast(nextToast);
  }

  function dismissToast(): void {
    setToast(null);
  }

  function focusTile(photoId: string | undefined): void {
    if (photoId === undefined) return;
    requestAnimationFrame((): void => tileRefs.current.get(photoId)?.focus());
  }

  async function uploadPhoto(photoId: string, file: File): Promise<void> {
    onUploadStarted(photoId);

    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("files", compressed, uploadFilename(file, compressed));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      let body: UploadResponse = {};
      try {
        body = parseUploadResponse(await response.json());
      } catch {
        // Keep the status-based fallback for a non-JSON response.
      }

      if (!response.ok) {
        throw new Error(
          body.error ?? `Photo upload failed with status ${response.status}.`,
        );
      }

      const url = body.urls?.[0];
      if (url === undefined) {
        throw new Error("The upload completed without returning a photo URL.");
      }

      if (!reuploadOnUndo) fileByPhotoIdRef.current.delete(photoId);
      onUploadSucceeded(photoId, url);
    } catch (error: unknown) {
      onUploadFailed(
        photoId,
        error instanceof Error ? error.message : "Photo upload failed.",
      );
    }
  }

  function addFiles(fileList: FileList | File[]): void {
    if (disabled) return;

    const imageFiles = Array.from(fileList).filter((file: File): boolean =>
      isAllowedMimeType(file.type),
    );
    if (imageFiles.length === 0) return;

    const validFiles: File[] = [];
    const fileErrors: string[] = [];
    for (const file of imageFiles) {
      if (file.size <= 0) {
        fileErrors.push(`${file.name} is empty.`);
      } else if (file.size > MAX_FILE_BYTES) {
        fileErrors.push(
          `${file.name} exceeds the ${formatMegabytes(MAX_FILE_BYTES)} limit.`,
        );
      } else {
        validFiles.push(file);
      }
    }

    const availableSlots = Math.max(0, maxFiles - photos.length);
    const acceptedFiles = validFiles.slice(0, availableSlots);
    const skippedForLimit = validFiles.length - acceptedFiles.length;
    const additions = acceptedFiles.map((file: File): DraftPhoto => {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      createdPreviewUrlsRef.current.add(previewUrl);
      fileByPhotoIdRef.current.set(id, file);
      return createDraftPhoto(id, file.name, previewUrl);
    });

    if (additions.length > 0) {
      onAddPhotos(additions);
      for (const addition of additions) {
        const file = fileByPhotoIdRef.current.get(addition.id);
        if (file !== undefined) void uploadPhoto(addition.id, file);
      }
    }

    const messages: string[] = [];
    if (additions.length > 0 || skippedForLimit > 0) {
      messages.push(
        `${additions.length} ${additions.length === 1 ? "photo" : "photos"} added${
          skippedForLimit > 0
            ? ` · ${skippedForLimit} over the ${maxFiles}-photo limit`
            : ""
        }`,
      );
    }
    messages.push(...fileErrors);
    if (messages.length > 0) {
      showToast({ text: messages.join(" "), canUndo: false });
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files !== null) addFiles(event.target.files);
    event.target.value = "";
  }

  function removePhoto(photo: DraftPhoto, index: number): void {
    if (disabled) return;
    const focusId = photos[index + 1]?.id ?? photos[index - 1]?.id;
    setMobileActionsPhotoId(null);
    onRemovePhoto(photo.id);
    showToast({ text: `Removed ${photo.filename}`, canUndo: true });
    focusTile(focusId);
  }

  function retryUpload(photo: DraftPhoto): void {
    const file = fileByPhotoIdRef.current.get(photo.id);
    if (disabled || file === undefined) return;
    void uploadPhoto(photo.id, file);
  }

  function moveAndRefocus(photoId: string, toIndex: number): void {
    onMovePhoto(photoId, toIndex);
    focusTile(photoId);
  }

  function handleTileKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    photo: DraftPhoto,
    index: number,
  ): void {
    if (disabled || event.target !== event.currentTarget) return;

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      moveAndRefocus(photo.id, index - 1);
    } else if (event.key === "ArrowRight" && index < photos.length - 1) {
      event.preventDefault();
      moveAndRefocus(photo.id, index + 1);
    } else if (event.key === "Enter" && index > 0) {
      event.preventDefault();
      onSetCover(photo.id);
      focusTile(photo.id);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removePhoto(photo, index);
    }
  }

  function handlePanelDragOver(event: DragEvent<HTMLElement>): void {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    if (!disabled) setIsFileDragOver(true);
  }

  function handlePanelDrop(event: DragEvent<HTMLElement>): void {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsFileDragOver(false);
    addFiles(event.dataTransfer.files);
  }

  return (
    <section
      id="photos"
      tabIndex={-1}
      aria-labelledby="photo-manager-heading"
      onDragOver={handlePanelDragOver}
      onDragLeave={(event): void => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setIsFileDragOver(false);
      }}
      onDrop={handlePanelDrop}
      className={`scroll-mt-32 rounded-xl border p-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-green-500 sm:p-5 ${
        isFileDragOver
          ? "border-green-500 bg-green-500/[.06]"
          : "border-black/15 bg-black/[.02] dark:border-white/20 dark:bg-white/[.02]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes}
        multiple
        disabled={disabled}
        onChange={handleInputChange}
        className="sr-only"
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="photo-manager-heading" className="font-semibold">
            Photos
          </h2>
          <p className="mt-1 text-xs text-black/60 dark:text-white/60">
            {photos.length} of {maxFiles} · first is the cover
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || photos.length >= maxFiles}
          onClick={(): void => inputRef.current?.click()}
          className="min-h-11 rounded-md border border-black/15 px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 sm:min-h-0 sm:py-2"
        >
          Add photos
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {photos.map((photo: DraftPhoto, index: number) => {
          const isCover = index === 0;
          const isDragged = draggedPhotoId === photo.id;
          const isDragTarget = dragOverPhotoId === photo.id;

          return (
            <div
              key={photo.id}
              ref={(element): void => {
                if (element === null) tileRefs.current.delete(photo.id);
                else tileRefs.current.set(photo.id, element);
              }}
              role="group"
              tabIndex={disabled ? -1 : 0}
              draggable={!disabled}
              aria-label={`${photo.filename} · photo ${index + 1} of ${photos.length}${
                isCover ? " · cover" : ""
              }. Arrow keys move, Delete removes, Enter sets cover.`}
              onKeyDown={(event): void =>
                handleTileKeyDown(event, photo, index)
              }
              onDragStart={(event): void => {
                setDraggedPhotoId(photo.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", photo.id);
              }}
              onDragOver={(event): void => {
                if (event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                event.stopPropagation();
                setDragOverPhotoId(photo.id);
              }}
              onDrop={(event): void => {
                if (event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                event.stopPropagation();
                if (draggedPhotoId !== null) {
                  moveAndRefocus(draggedPhotoId, index);
                }
                setDraggedPhotoId(null);
                setDragOverPhotoId(null);
              }}
              onDragEnd={(): void => {
                setDraggedPhotoId(null);
                setDragOverPhotoId(null);
              }}
              className={`group relative aspect-square overflow-hidden rounded-lg border bg-black/[.04] outline-none transition dark:bg-white/[.04] ${
                isDragTarget
                  ? "border-green-500 ring-1 ring-green-500"
                  : isCover
                    ? "border-black/50 dark:border-white/55"
                    : "border-black/15 dark:border-white/15"
              } ${isDragged ? "opacity-40" : "opacity-100"} focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
            >
              {photo.origin === "new" ? (
                <>
                  {/* Object URLs are local browser previews, so the Next.js image optimizer cannot fetch them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl}
                    alt=""
                    draggable={false}
                    className="size-full object-cover"
                  />
                </>
              ) : (
                <Image
                  src={photo.previewUrl}
                  alt=""
                  fill
                  sizes="(max-width: 639px) calc((100vw - 4.5rem) / 2), 160px"
                  draggable={false}
                  className="object-cover"
                />
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/75 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 to-transparent" />

              <span
                className={`absolute left-1.5 top-1.5 z-20 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  isCover
                    ? "bg-white text-black"
                    : "bg-black/60 text-white"
                }`}
              >
                {isCover ? "Cover" : index + 1}
              </span>
              <button
                type="button"
                draggable={false}
                disabled={disabled}
                onClick={(): void => removePhoto(photo, index)}
                aria-label={`Remove ${photo.filename}`}
                className="absolute right-1 top-1 z-20 inline-flex size-11 items-center justify-center rounded-full bg-black/65 text-base text-white hover:bg-black/85 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:opacity-50 sm:size-8"
              >
                <span aria-hidden="true">×</span>
              </button>

              {photo.status === "uploading" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 px-2 text-center text-xs font-medium text-white">
                  Uploading…
                </div>
              )}
              {photo.status === "error" && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 p-2 text-center text-white">
                  <p className="line-clamp-2 text-[11px]">
                    {photo.error ?? "Upload failed"}
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(): void => retryUpload(photo)}
                    className="min-h-11 rounded-md border border-white/45 px-3 text-xs font-semibold hover:bg-white/10 disabled:opacity-50 sm:min-h-8 sm:px-2"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!isCover && photo.status === "ready" && (
                <button
                  type="button"
                  draggable={false}
                  disabled={disabled}
                  onClick={(): void => {
                    onSetCover(photo.id);
                    focusTile(photo.id);
                  }}
                  className="absolute inset-x-1.5 bottom-1.5 z-20 hidden min-h-8 rounded border border-white/40 bg-black/45 px-2 text-[11px] font-medium text-white hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:opacity-50 sm:block"
                >
                  Set as cover
                </button>
              )}

              {photo.status === "ready" && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(): void => setMobileActionsPhotoId(photo.id)}
                  aria-expanded={mobileActionsPhotoId === photo.id}
                  aria-label={`Reorder or change cover for ${photo.filename}`}
                  className="absolute inset-x-1.5 bottom-1.5 z-20 min-h-11 rounded border border-white/40 bg-black/55 px-2 text-[11px] font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:opacity-50 sm:hidden"
                >
                  Move / cover
                </button>
              )}

              {mobileActionsPhotoId === photo.id && (
                <div
                  role="group"
                  aria-label={`Actions for ${photo.filename}`}
                  onKeyDown={(event): void => {
                    if (event.key !== "Escape") return;
                    setMobileActionsPhotoId(null);
                    focusTile(photo.id);
                  }}
                  className="absolute inset-0 z-30 flex flex-col justify-end gap-2 bg-black/80 p-2 text-white sm:hidden"
                >
                  <button
                    type="button"
                    onClick={(): void => setMobileActionsPhotoId(null)}
                    aria-label="Close photo actions"
                    className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-full text-xl"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(): void => {
                        moveAndRefocus(photo.id, index - 1);
                        setMobileActionsPhotoId(null);
                      }}
                      className="min-h-11 rounded-md border border-white/40 px-2 text-xs font-semibold disabled:opacity-35"
                    >
                      Move left
                    </button>
                    <button
                      type="button"
                      disabled={index === photos.length - 1}
                      onClick={(): void => {
                        moveAndRefocus(photo.id, index + 1);
                        setMobileActionsPhotoId(null);
                      }}
                      className="min-h-11 rounded-md border border-white/40 px-2 text-xs font-semibold disabled:opacity-35"
                    >
                      Move right
                    </button>
                  </div>
                  {!isCover && (
                    <button
                      type="button"
                      onClick={(): void => {
                        onSetCover(photo.id);
                        setMobileActionsPhotoId(null);
                        focusTile(photo.id);
                      }}
                      className="min-h-11 rounded-md bg-white px-2 text-xs font-semibold text-black"
                    >
                      Set as cover
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {photos.length < maxFiles && (
          <button
            type="button"
            disabled={disabled}
            onClick={(): void => inputRef.current?.click()}
            aria-label="Add photos"
            className="flex aspect-square min-h-11 flex-col items-center justify-center rounded-lg border border-dashed border-black/20 text-black/55 hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 dark:border-white/25 dark:text-white/55 dark:hover:bg-white/[.04]"
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              +
            </span>
            <span className="mt-2 text-xs">Add photos</span>
          </button>
        )}
      </div>

      {photos.length === 0 && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          Add at least one photo.
        </p>
      )}
      <p className="mt-4 text-xs leading-5 text-black/60 dark:text-white/60">
        Drag a photo onto another to reorder. The cover is what shows in
        Listings, Analytics and the copy you paste into each marketplace.
      </p>

      {toast !== null && (
        <UndoToast
          message={toast.text}
          onUndo={
            toast.canUndo && lastRemoval !== null
              ? (): void => {
                  const restoredId = lastRemoval.photo.id;
                  const restoredFile =
                    fileByPhotoIdRef.current.get(restoredId);
                  const shouldReupload =
                    reuploadOnUndo &&
                    lastRemoval.photo.status === "ready" &&
                    restoredFile !== undefined;
                  onUndoRemove();
                  dismissToast();
                  focusTile(restoredId);
                  if (shouldReupload) {
                    void uploadPhoto(restoredId, restoredFile);
                  }
                }
              : undefined
          }
          onDismiss={dismissToast}
        />
      )}
    </section>
  );
}

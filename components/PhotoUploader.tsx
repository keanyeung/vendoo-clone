"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { compressImage } from "@/lib/compress";
import {
  ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  MAX_FILE_BYTES,
  MAX_FILES,
} from "@/lib/upload-limits";

export type Props = {
  onChange?: (urls: string[]) => void;
  maxFiles?: number;
  disabled?: boolean;
};

type UploadStatus = "compressing" | "uploading" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  url?: string;
  error?: string;
};

type UploadResponse = {
  urls?: string[];
  error?: string;
};

const acceptedTypes = Object.keys(ALLOWED_MIME_TYPES).join(",");

function formatMegabytes(bytes: number): string {
  const megabytes = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return `${megabytes} MB`;
}

function uploadFilename(file: File, blob: Blob): string {
  if (blob.type !== "image/jpeg") return file.name;

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  return `${baseName || "photo"}.jpg`;
}

function parseUploadResponse(value: unknown): UploadResponse {
  if (!value || typeof value !== "object") return {};

  const record = value as Record<string, unknown>;
  return {
    error: typeof record.error === "string" ? record.error : undefined,
    urls:
      Array.isArray(record.urls) &&
      record.urls.every((url: unknown): url is string => typeof url === "string")
        ? record.urls
        : undefined,
  };
}

export default function PhotoUploader({
  onChange,
  maxFiles = MAX_FILES,
  disabled = false,
}: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [message, setMessage] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UploadItem[]>([]);
  const onChangeRef = useRef(onChange);
  const notifiedUrlsRef = useRef<string | undefined>(undefined);

  useEffect((): void => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect((): void => {
    itemsRef.current = items;
  }, [items]);

  useEffect((): void => {
    const urls = items.flatMap((item: UploadItem): string[] =>
      item.status === "done" && item.url ? [item.url] : [],
    );
    const serializedUrls = JSON.stringify(urls);

    if (notifiedUrlsRef.current !== serializedUrls) {
      notifiedUrlsRef.current = serializedUrls;
      onChangeRef.current?.(urls);
    }
  }, [items]);

  useEffect(() => {
    return (): void => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  function updateItem(id: string, update: Partial<UploadItem>): void {
    setItems((currentItems: UploadItem[]): UploadItem[] =>
      currentItems.map((item: UploadItem): UploadItem =>
        item.id === id ? { ...item, ...update } : item,
      ),
    );
  }

  async function uploadItem(item: UploadItem): Promise<void> {
    try {
      const compressed = await compressImage(item.file);
      updateItem(item.id, { status: "uploading" });

      const formData = new FormData();
      formData.append(
        "files",
        compressed,
        uploadFilename(item.file, compressed),
      );

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const body = parseUploadResponse(await response.json());

      if (!response.ok) {
        throw new Error(body.error ?? "Photo upload failed.");
      }

      const url = body.urls?.[0];
      if (!url) {
        throw new Error("The upload completed without returning a photo URL.");
      }

      updateItem(item.id, { status: "done", url });
    } catch (error) {
      updateItem(item.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Photo upload failed.",
      });
    }
  }

  function handleFiles(fileList: FileList | File[]): void {
    if (disabled) return;

    const files = Array.from(fileList);
    const availableSlots = Math.max(0, maxFiles - itemsRef.current.length);
    const errors: string[] = [];

    const validFiles = files.filter((file: File): boolean => {
      if (!isAllowedMimeType(file.type)) {
        errors.push(`"${file.name}" has an unsupported file type.`);
        return false;
      }

      if (file.size > MAX_FILE_BYTES) {
        errors.push(
          `"${file.name}" exceeds the ${formatMegabytes(MAX_FILE_BYTES)} size limit.`,
        );
        return false;
      }

      return true;
    });
    const acceptedFiles = validFiles.slice(0, availableSlots);

    if (acceptedFiles.length < validFiles.length) {
      errors.push(`Only ${maxFiles} photos can be added.`);
    }

    setMessage(errors.length > 0 ? errors.join(" ") : undefined);

    const newItems = acceptedFiles.map(
      (file: File): UploadItem => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "compressing",
      }),
    );

    if (newItems.length === 0) return;

    const nextItems = [...itemsRef.current, ...newItems];
    itemsRef.current = nextItems;
    setItems(nextItems);
    void Promise.all(newItems.map(uploadItem));
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files) handleFiles(event.target.files);
    event.target.value = "";
  }

  function openFilePicker(): void {
    if (!disabled) inputRef.current?.click();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openFilePicker();
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  function removeItem(itemToRemove: UploadItem): void {
    if (disabled) return;

    URL.revokeObjectURL(itemToRemove.previewUrl);
    const nextItems = itemsRef.current.filter(
      (item: UploadItem): boolean => item.id !== itemToRemove.id,
    );
    itemsRef.current = nextItems;
    setItems(nextItems);
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        disabled={disabled}
        onChange={handleInputChange}
        className="sr-only"
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border border-dashed p-8 text-center outline-none transition-colors ${
          isDragging
            ? "border-black/50 bg-black/[.04] dark:border-white/60 dark:bg-white/[.06]"
            : "border-black/15 dark:border-white/20"
        } ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:bg-black/[.04] focus:border-black/40 dark:hover:bg-white/[.06] dark:focus:border-white/50"
        }`}
      >
        <p className="text-sm font-medium">Drop photos here or choose files</p>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Up to {maxFiles} photos, {formatMegabytes(MAX_FILE_BYTES)} each
        </p>
      </div>

      {message && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
        >
          <p>{message}</p>
          <button
            type="button"
            onClick={() => setMessage(undefined)}
            className="shrink-0 font-medium"
            aria-label="Dismiss upload message"
          >
            Dismiss
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item: UploadItem) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-xl border border-black/15 dark:border-white/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt={`Preview of ${item.file.name}`}
                className="aspect-square w-full object-cover"
              />
              <div className="space-y-1 border-t border-black/10 p-2 text-xs dark:border-white/15">
                <p className="truncate font-medium">{item.file.name}</p>
                {item.status !== "done" && item.status !== "error" && (
                  <p className="capitalize text-black/60 dark:text-white/60">
                    {item.status}…
                  </p>
                )}
                {item.status === "error" && (
                  <p className="text-red-600 dark:text-red-400">{item.error}</p>
                )}
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeItem(item)}
                aria-label={`Remove ${item.file.name}`}
                className="absolute right-2 top-2 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

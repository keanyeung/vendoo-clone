"use client";

import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useItemDetail } from "@/components/item/ItemDetailProvider";
import { ITEM_TITLE_MAX_LENGTH } from "@/lib/item-schema";
import { formatPrice } from "@/lib/listing-text";

type EditableField = "title" | "listPrice";
type SaveState = "idle" | "saving" | "saved";

type QuickEditFieldProps = {
  field: EditableField;
  label: string;
  as: "h1" | "dd";
  containerClassName?: string;
  valueClassName?: string;
  inputClassName?: string;
};

function valueAsText(value: string | number): string {
  return typeof value === "number" ? String(value) : value;
}

function displayValue(field: EditableField, value: string | number): string {
  return field === "listPrice" ? formatPrice(value as number) : String(value);
}

function validateDraft(
  field: EditableField,
  draft: string,
): { value: string | number } | { error: string } {
  if (field === "title") {
    const title = draft.trim();
    if (title.length === 0) return { error: "Title is required." };
    if (title.length > ITEM_TITLE_MAX_LENGTH) {
      return {
        error: `Title must be ${ITEM_TITLE_MAX_LENGTH} characters or fewer.`,
      };
    }
    return { value: title };
  }

  const price = Number(draft);
  if (!Number.isFinite(price) || price <= 0) {
    return { error: "List price must be greater than 0." };
  }
  if (Math.round(price * 100) / 100 !== price) {
    return { error: "List price can have at most 2 decimal places." };
  }
  return { value: price };
}

async function responseError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Use the status fallback when the response is not JSON.
  }
  return `Saving failed with status ${response.status}.`;
}

export default function QuickEditField({
  field,
  label,
  as: Container,
  containerClassName,
  valueClassName,
  inputClassName,
}: QuickEditFieldProps) {
  const router = useRouter();
  const { item, setItem } = useItemDetail();
  const savedValue = item[field];
  const [draft, setDraft] = useState<string>(() => valueAsText(savedValue));
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelledRef = useRef<boolean>(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return (): void => clearTimeout(feedbackTimeoutRef.current);
  }, []);

  function beginEditing(): void {
    if (saveState === "saving") return;
    cancelledRef.current = false;
    clearTimeout(feedbackTimeoutRef.current);
    setError(null);
    setSaveState("idle");
    setDraft(valueAsText(savedValue));
    setIsEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function cancelEditing(): void {
    cancelledRef.current = true;
    setDraft(valueAsText(savedValue));
    setIsEditing(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function commit(): Promise<void> {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }

    const parsed = validateDraft(field, draft);
    if ("error" in parsed) {
      setError(parsed.error);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    const nextValue = parsed.value;
    if (nextValue === savedValue) {
      setIsEditing(false);
      return;
    }

    const previousValue = savedValue;
    setIsEditing(false);
    setSaveState("saving");
    setItem((current) => ({ ...current, [field]: nextValue }));

    try {
      const response = await fetch(
        `/api/items/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "patch_fields",
            data: { [field]: nextValue },
          }),
        },
      );
      if (!response.ok) throw new Error(await responseError(response));

      setSaveState("saved");
      router.refresh();
      feedbackTimeoutRef.current = setTimeout(() => {
        setSaveState("idle");
      }, 1600);
    } catch (saveError: unknown) {
      setItem((current) => ({ ...current, [field]: previousValue }));
      setDraft(valueAsText(previousValue));
      setSaveState("idle");
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The change could not be saved.",
      );
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }

  function handleBlur(): void {
    void commit();
  }

  return (
    <>
      <Container className={containerClassName}>
        {isEditing ? (
          <span className="flex min-h-11 items-center">
            {field === "listPrice" && (
              <span aria-hidden="true" className="text-xl font-semibold">
                $
              </span>
            )}
            <input
              ref={inputRef}
              type={field === "listPrice" ? "number" : "text"}
              inputMode={field === "listPrice" ? "decimal" : undefined}
              min={field === "listPrice" ? "0.01" : undefined}
              step={field === "listPrice" ? "0.01" : undefined}
              maxLength={field === "title" ? ITEM_TITLE_MAX_LENGTH : undefined}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              aria-label={label}
              aria-invalid={error !== null}
              className={`min-h-11 min-w-0 flex-1 rounded-md border border-black/30 bg-background px-2 outline-none focus:border-foreground dark:border-white/35 ${inputClassName ?? ""}`}
            />
          </span>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            onClick={beginEditing}
            disabled={saveState === "saving"}
            aria-label={`Edit ${label.toLowerCase()}`}
            aria-busy={saveState === "saving"}
            className="group flex min-h-11 w-full min-w-0 items-center gap-2 text-left disabled:cursor-wait"
          >
            <span className={`min-w-0 flex-1 ${valueClassName ?? ""}`}>
              {displayValue(field, savedValue)}
            </span>
            <span
              aria-live="polite"
              className="shrink-0 text-xs font-medium text-black/45 group-hover:text-black/70 dark:text-white/45 dark:group-hover:text-white/70"
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : "Edit"}
            </span>
          </button>
        )}
      </Container>

      {error !== null && (
        <div
          role="alert"
          className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-red-600/30 bg-background p-3 text-sm text-red-700 shadow-lg dark:border-red-400/30 dark:text-red-400"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="min-h-11 shrink-0 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}

"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { CONDITION_VALUES } from "@/lib/analysis-schema";
import type { ItemDto } from "@/lib/item-dto";
import { UpdateItemSchema } from "@/lib/item-schema";

export type ItemEditSectionProps = {
  item: ItemDto;
};

type Condition = (typeof CONDITION_VALUES)[number];
type FieldErrors = Record<string, string>;
type FormState = {
  title: string;
  summary: string;
  description: string;
  brand: string;
  category: string;
  size: string;
  color: string;
  condition: Condition;
  conditionNotes: string;
  listPrice: string;
  purchasePrice: string;
  keywords: string;
  purchaseDate: string;
  notes: string;
};

const control =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

function nullable(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function deriveFormState(item: ItemDto): FormState {
  const condition =
    CONDITION_VALUES.find((value: Condition): boolean => value === item.condition) ??
    "good";

  return {
    title: item.title,
    summary: item.summary ?? "",
    description: item.description,
    brand: item.brand ?? "",
    category: item.category ?? "",
    size: item.size ?? "",
    color: item.color ?? "",
    condition,
    conditionNotes: item.conditionNotes ?? "",
    listPrice: String(item.listPrice),
    purchasePrice: String(item.purchasePrice),
    keywords: item.keywords.join(", "),
    purchaseDate:
      item.purchaseDate === null ? "" : item.purchaseDate.slice(0, 10),
    notes: item.notes ?? "",
  };
}

function ErrorText({
  name,
  errors,
}: {
  name: string;
  errors: FieldErrors;
}) {
  return errors[name] ? (
    <p className="text-sm text-red-600 dark:text-red-400">{errors[name]}</p>
  ) : null;
}

export default function ItemEditSection({
  item,
}: ItemEditSectionProps) {
  const router = useRouter();
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [form, setForm] = useState<FormState>(() => deriveFormState(item));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  useEffect((): (() => void) => {
    return (): void => {
      if (confirmationTimer.current !== null) {
        clearTimeout(confirmationTimer.current);
      }
    };
  }, []);

  function updateField(
    field: keyof FormState,
  ): (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void {
    return (event): void => {
      const value = event.target.value;
      setForm((current: FormState): FormState => ({
        ...current,
        [field]: value,
      }));
    };
  }

  function resetForm(): void {
    setForm(deriveFormState(item));
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleOpen(): void {
    resetForm();
    setSaved(false);
    setIsExpanded(true);
  }

  function handleCancel(): void {
    resetForm();
    setIsExpanded(false);
  }

  function showConfirmation(): void {
    if (confirmationTimer.current !== null) {
      clearTimeout(confirmationTimer.current);
    }
    setSaved(true);
    confirmationTimer.current = setTimeout((): void => {
      setSaved(false);
      confirmationTimer.current = null;
    }, 2500);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (isSaving) return;

    const payload = {
      title: form.title,
      summary: nullable(form.summary),
      description: form.description,
      brand: nullable(form.brand),
      category: form.category,
      size: nullable(form.size),
      color: nullable(form.color),
      condition: form.condition,
      conditionNotes: nullable(form.conditionNotes),
      listPrice:
        form.listPrice === "" ? Number.NaN : Number(form.listPrice),
      purchasePrice:
        form.purchasePrice === "" ? Number.NaN : Number(form.purchasePrice),
      keywords: form.keywords
        .split(",")
        .map((value: string): string => value.trim())
        .filter((value: string): boolean => value !== ""),
      purchaseDate: nullable(form.purchaseDate),
      notes: nullable(form.notes),
    };
    const parsed = UpdateItemSchema.safeParse(payload);

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const segment = issue.path[0];
        const name = typeof segment === "string" ? segment : "form";
        if (!next[name]) next[name] = issue.message;
      }
      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", data: parsed.data }),
      });

      if (!response.ok) {
        let message = `Saving failed with status ${response.status}.`;
        try {
          const body: unknown = await response.json();
          if (
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
          ) {
            message = body.error;
          }
        } catch {
          // Keep the status-based fallback when the response is not JSON.
        }
        setSubmitError(message);
        return;
      }

      router.refresh();
      setIsExpanded(false);
      showConfirmation();
    } catch {
      setSubmitError(
        "Could not reach the save service. Check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const shortFields: Array<{
    id: keyof Pick<FormState, "brand" | "category" | "size" | "color">;
    label: string;
  }> = [
    { id: "brand", label: "Brand" },
    { id: "category", label: "Category" },
    { id: "size", label: "Size" },
    { id: "color", label: "Color" },
  ];

  return (
    <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Edit</h2>
          {!isExpanded && (
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Update this item&apos;s listing and purchase details.
            </p>
          )}
        </div>
        {!isExpanded && (
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
          >
            Edit item
          </button>
        )}
      </div>

      {saved && (
        <p
          role="status"
          className="mt-4 text-sm font-medium text-green-700 dark:text-green-400"
        >
          Saved
        </p>
      )}

      {isExpanded && (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-6 space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="edit-title" className="text-sm font-medium">
                Title
              </label>
              <input
                id="edit-title"
                value={form.title}
                onChange={updateField("title")}
                className={control}
              />
              <ErrorText name="title" errors={fieldErrors} />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="edit-summary" className="text-sm font-medium">
                Summary
              </label>
              <textarea
                id="edit-summary"
                rows={2}
                value={form.summary}
                onChange={updateField("summary")}
                className={control}
              />
              <ErrorText name="summary" errors={fieldErrors} />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="edit-description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="edit-description"
                rows={5}
                value={form.description}
                onChange={updateField("description")}
                className={control}
              />
              <ErrorText name="description" errors={fieldErrors} />
            </div>

            {shortFields.map((field) => (
              <div key={field.id} className="space-y-1">
                <label
                  htmlFor={`edit-${field.id}`}
                  className="text-sm font-medium"
                >
                  {field.label}
                </label>
                <input
                  id={`edit-${field.id}`}
                  value={form[field.id]}
                  onChange={updateField(field.id)}
                  className={control}
                />
                <ErrorText name={field.id} errors={fieldErrors} />
              </div>
            ))}

            <div className="space-y-1">
              <label htmlFor="edit-condition" className="text-sm font-medium">
                Condition
              </label>
              <select
                id="edit-condition"
                value={form.condition}
                onChange={updateField("condition")}
                className={control}
              >
                {CONDITION_VALUES.map((value: Condition) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <ErrorText name="condition" errors={fieldErrors} />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-list-price" className="text-sm font-medium">
                List price
              </label>
              <input
                id="edit-list-price"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                // Blur on wheel so scrolling the page over a focused number
                // input cannot silently change the amount (45 -> 44.99).
                onWheel={(event) => event.currentTarget.blur()}
                value={form.listPrice}
                onChange={updateField("listPrice")}
                className={control}
              />
              <ErrorText name="listPrice" errors={fieldErrors} />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="edit-purchase-price"
                className="text-sm font-medium"
              >
                Purchase price
              </label>
              <input
                id="edit-purchase-price"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                // Blur on wheel so scrolling the page over a focused number
                // input cannot silently change the amount (45 -> 44.99).
                onWheel={(event) => event.currentTarget.blur()}
                value={form.purchasePrice}
                onChange={updateField("purchasePrice")}
                className={control}
              />
              <ErrorText name="purchasePrice" errors={fieldErrors} />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="edit-purchase-date"
                className="text-sm font-medium"
              >
                Purchase date
              </label>
              <input
                id="edit-purchase-date"
                type="date"
                value={form.purchaseDate}
                onChange={updateField("purchaseDate")}
                className={control}
              />
              <ErrorText name="purchaseDate" errors={fieldErrors} />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label
                htmlFor="edit-condition-notes"
                className="text-sm font-medium"
              >
                Condition notes
              </label>
              <textarea
                id="edit-condition-notes"
                rows={3}
                value={form.conditionNotes}
                onChange={updateField("conditionNotes")}
                className={control}
              />
              <ErrorText name="conditionNotes" errors={fieldErrors} />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="edit-keywords" className="text-sm font-medium">
                Keywords
              </label>
              <input
                id="edit-keywords"
                value={form.keywords}
                onChange={updateField("keywords")}
                className={control}
              />
              <p className="text-xs text-black/60 dark:text-white/60">
                Separate keywords with commas.
              </p>
              <ErrorText name="keywords" errors={fieldErrors} />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="edit-notes" className="text-sm font-medium">
                Notes
              </label>
              <textarea
                id="edit-notes"
                rows={3}
                value={form.notes}
                onChange={updateField("notes")}
                className={control}
              />
              <ErrorText name="notes" errors={fieldErrors} />
            </div>
          </div>

          {submitError && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
            >
              <p>{submitError}</p>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="shrink-0 font-medium"
                aria-label="Dismiss save error"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

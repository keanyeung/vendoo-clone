"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useState,
} from "react";
import { CONDITION_VALUES } from "@/lib/analysis-schema";
import type { DraftItemStatus, ItemDraft } from "@/lib/item-draft";

export type FieldErrors = Record<string, string>;

export type ItemFormProps = {
  draft: ItemDraft;
  fieldErrors: FieldErrors;
  submitError: string | null;
  isSaving: boolean;
  canSaveListed: boolean;
  onChange: <Key extends keyof ItemDraft>(
    field: Key,
    value: ItemDraft[Key],
  ) => void;
  onSubmit: (status: DraftItemStatus) => void;
  onDismissSubmitError: () => void;
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const control =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";
const moneyControl = `${control} pl-7`;

function ErrorText({ name, errors }: { name: string; errors: FieldErrors }) {
  return errors[name] ? (
    <p className="text-sm text-red-600 dark:text-red-400">{errors[name]}</p>
  ) : null;
}

function conditionLabel(value: ItemDraft["condition"]): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter: string): string => letter.toUpperCase());
}

function firstTwoSentences(value: string): string {
  const sentences =
    value.trim().match(/[^.!?]+(?:[.!?]+|$)/g)?.map((sentence: string) =>
      sentence.trim(),
    ) ?? [];
  return sentences.slice(0, 2).join(" ");
}

function keywordValues(value: string): string[] {
  return value
    .split(",")
    .map((keyword: string): string => keyword.trim())
    .filter((keyword: string): boolean => keyword !== "");
}

export default function ItemForm({
  draft,
  fieldErrors,
  submitError,
  isSaving,
  canSaveListed,
  onChange,
  onSubmit,
  onDismissSubmitError,
}: ItemFormProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const keywords = keywordValues(draft.keywords);
  const purchasePriceMissing = draft.purchasePrice.trim() === "";
  const attributeSummary = [draft.brand, draft.category, draft.size]
    .map((value: string): string => value.trim())
    .filter((value: string): boolean => value !== "")
    .join(" · ");

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isSaving) return;

    const submitter =
      event.nativeEvent instanceof SubmitEvent
        ? event.nativeEvent.submitter
        : null;
    const status: DraftItemStatus =
      submitter instanceof HTMLButtonElement && submitter.value === "DRAFT"
        ? "DRAFT"
        : "LISTED";
    onSubmit(status);
  }

  function writeKeywords(nextKeywords: string[]): void {
    onChange("keywords", nextKeywords.join(", "));
  }

  function removeKeyword(indexToRemove: number): void {
    writeKeywords(
      keywords.filter(
        (_keyword: string, index: number): boolean => index !== indexToRemove,
      ),
    );
  }

  function commitKeyword(): void {
    const keyword = newKeyword.trim();
    if (
      keyword !== "" &&
      keywords.length < 15 &&
      !keywords.some(
        (existing: string): boolean =>
          existing.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
      )
    ) {
      writeKeywords([...keywords, keyword]);
    }
    setNewKeyword("");
    setIsAddingKeyword(false);
  }

  function handleKeywordKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commitKeyword();
    }
    if (event.key === "Escape") {
      setNewKeyword("");
      setIsAddingKeyword(false);
    }
  }

  return (
    <form
      id="item-form"
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-black/15 p-5 dark:border-white/20"
    >
      <h2 className="text-xl font-semibold">Review item details</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1 lg:col-span-2">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            value={draft.title}
            onChange={(event) => onChange("title", event.target.value)}
            className={control}
          />
          <ErrorText name="title" errors={fieldErrors} />
        </div>

        <div className="space-y-1 lg:col-span-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            rows={5}
            value={draft.description}
            onChange={(event) => onChange("description", event.target.value)}
            className={control}
          />
          <ErrorText name="description" errors={fieldErrors} />
        </div>

        <div className="space-y-1">
          <label htmlFor="listPrice" className="text-sm font-medium">
            List price
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-black/45 dark:text-white/45"
            >
              $
            </span>
            <input
              id="listPrice"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              onWheel={(event) => event.currentTarget.blur()}
              value={draft.listPrice}
              onChange={(event) => onChange("listPrice", event.target.value)}
              className={moneyControl}
            />
          </div>
          <ErrorText name="listPrice" errors={fieldErrors} />
          <div className="rounded-md border border-black/10 bg-black/[.025] p-3 dark:border-white/15 dark:bg-white/[.035]">
            <p className="text-xs font-semibold">
              AI suggests {money.format(draft.suggestedPrice)} · range{" "}
              {money.format(draft.priceLow)}–{money.format(draft.priceHigh)} ·{" "}
              <span className="capitalize">{draft.aiConfidence}</span>{" "}
              confidence
            </p>
            <p className="mt-1 text-xs leading-5 text-black/60 dark:text-white/60">
              {firstTwoSentences(draft.priceReasoning)}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="purchasePrice" className="text-sm font-medium">
            Purchase price{" "}
            <span className="text-red-600 dark:text-red-400" aria-hidden="true">
              *
            </span>
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-black/45 dark:text-white/45"
            >
              $
            </span>
            <input
              id="purchasePrice"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              aria-required="true"
              aria-invalid={purchasePriceMissing || !!fieldErrors.purchasePrice}
              aria-describedby="purchase-price-help"
              onWheel={(event) => event.currentTarget.blur()}
              value={draft.purchasePrice}
              onChange={(event) =>
                onChange("purchasePrice", event.target.value)
              }
              className={`${moneyControl} ${
                purchasePriceMissing || fieldErrors.purchasePrice
                  ? "border-red-600/50 bg-red-600/[.05] focus:border-red-600/70 dark:border-red-400/50 dark:focus:border-red-400/70"
                  : ""
              }`}
            />
          </div>
          {purchasePriceMissing ? (
            <p
              id="purchase-price-help"
              className="text-sm text-red-600 dark:text-red-400"
            >
              Required — profit and ROI can&apos;t be tracked without it.
            </p>
          ) : (
            <div id="purchase-price-help">
              <ErrorText name="purchasePrice" errors={fieldErrors} />
            </div>
          )}
        </div>

        <div className="space-y-1 lg:col-span-2">
          <label htmlFor="condition" className="text-sm font-medium">
            Condition
          </label>
          <select
            id="condition"
            value={draft.condition}
            onChange={(event) =>
              onChange(
                "condition",
                event.target.value as ItemDraft["condition"],
              )
            }
            className={control}
          >
            {CONDITION_VALUES.map((value) => (
              <option key={value} value={value}>
                {conditionLabel(value)}
              </option>
            ))}
          </select>
          <p className="text-xs text-black/60 dark:text-white/60">
            AI read this as{" "}
            <strong className="font-semibold">
              {conditionLabel(draft.aiCondition)}
            </strong>{" "}
            from the photos.
          </p>
          <ErrorText name="condition" errors={fieldErrors} />
        </div>
      </div>

      <section className="border-t border-black/10 pt-4 dark:border-white/15">
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="item-attributes"
          onClick={() => setDetailsOpen((current: boolean) => !current)}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left lg:hidden"
        >
          <span>
            <span className="block font-semibold">More details</span>
            {attributeSummary !== "" && (
              <span className="mt-0.5 block text-xs text-black/55 dark:text-white/55">
                {attributeSummary}
              </span>
            )}
          </span>
          <span aria-hidden="true">{detailsOpen ? "▾" : "▸"}</span>
        </button>

        <p className="mb-3 hidden text-xs font-semibold tracking-[0.08em] text-black/50 uppercase dark:text-white/50 lg:block">
          Item attributes
        </p>

        <div
          id="item-attributes"
          className={`gap-4 lg:grid lg:grid-cols-2 ${
            detailsOpen ? "grid pt-3" : "hidden"
          } lg:pt-0`}
        >
          {(
            [
              ["brand", "Brand"],
              ["category", "Category"],
              ["size", "Size"],
              ["color", "Color"],
            ] as const
          ).map(([id, label]) => (
            <div key={id} className="space-y-1">
              <label htmlFor={id} className="text-sm font-medium">
                {label}
              </label>
              <input
                id={id}
                value={draft[id]}
                onChange={(event) => onChange(id, event.target.value)}
                className={control}
              />
              <ErrorText name={id} errors={fieldErrors} />
            </div>
          ))}

          <div className="space-y-1">
            <label htmlFor="purchaseDate" className="text-sm font-medium">
              Purchase date
            </label>
            <input
              id="purchaseDate"
              type="date"
              value={draft.purchaseDate}
              onChange={(event) => onChange("purchaseDate", event.target.value)}
              className={control}
            />
            <ErrorText name="purchaseDate" errors={fieldErrors} />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="conditionNotes" className="text-sm font-medium">
              Condition notes
            </label>
            <textarea
              id="conditionNotes"
              rows={3}
              value={draft.conditionNotes}
              onChange={(event) =>
                onChange("conditionNotes", event.target.value)
              }
              className={control}
            />
            <ErrorText name="conditionNotes" errors={fieldErrors} />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <span className="block text-sm font-medium">Keywords</span>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword: string, index: number) => (
                <button
                  key={`${keyword}-${index}`}
                  type="button"
                  onClick={() => removeKeyword(index)}
                  aria-label={`Remove keyword ${keyword}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black/[.06] px-3 text-sm dark:bg-white/[.08]"
                >
                  <span>{keyword}</span>
                  <span
                    aria-hidden="true"
                    className="text-black/40 dark:text-white/40"
                  >
                    ×
                  </span>
                </button>
              ))}

              {isAddingKeyword ? (
                <input
                  autoFocus
                  aria-label="New keyword"
                  value={newKeyword}
                  onChange={(event) => setNewKeyword(event.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  onBlur={commitKeyword}
                  className="min-h-11 w-40 rounded-full border border-black/20 bg-transparent px-3 text-base outline-none focus:border-black/40 dark:border-white/25 dark:focus:border-white/50"
                />
              ) : (
                <button
                  type="button"
                  disabled={keywords.length >= 15}
                  onClick={() => setIsAddingKeyword(true)}
                  className="inline-flex min-h-11 items-center rounded-full border border-dashed border-black/20 px-3 text-sm text-black/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/25 dark:text-white/60"
                >
                  + add
                </button>
              )}
            </div>
            <ErrorText name="keywords" errors={fieldErrors} />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Private notes
            </label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Only you see this — where you sourced it, etc."
              value={draft.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              className={control}
            />
            <ErrorText name="notes" errors={fieldErrors} />
          </div>
        </div>
      </section>

      <details className="hidden rounded-lg border border-black/15 bg-black/[.02] dark:border-white/15 dark:bg-white/[.025] lg:block">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
          Why this price?
        </summary>
        <p className="px-4 pb-4 text-sm leading-6 text-black/60 dark:text-white/60">
          {draft.priceReasoning}
        </p>
      </details>

      {submitError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
        >
          <p>{submitError}</p>
          <button
            type="button"
            onClick={onDismissSubmitError}
            className="min-h-11 shrink-0 font-medium"
            aria-label="Dismiss save error"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-black/10 pt-4 dark:border-white/15">
        <button
          type="submit"
          name="status"
          value="LISTED"
          disabled={isSaving || !canSaveListed}
          className="hidden min-h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60 lg:inline-flex lg:items-center"
        >
          {isSaving ? "Saving…" : "Save as listed"}
        </button>
        <button
          type="submit"
          name="status"
          value="DRAFT"
          disabled={isSaving}
          className="min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
        >
          Save as draft
        </button>
      </div>
    </form>
  );
}

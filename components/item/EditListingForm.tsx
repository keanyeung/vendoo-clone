"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";

import { CopyListingSection } from "@/components/CopyListingSection";
import { PhotoManager } from "@/components/item/PhotoManager";
import { CONDITION_VALUES } from "@/lib/analysis-schema";
import {
  buildEditDraftItemDto,
  buildItemUpdateInput,
} from "@/lib/item-edit-draft";
import type { ItemDraftFields } from "@/lib/item-edit-draft";
import type { ItemDto } from "@/lib/item-dto";
import { UpdateItemSchema } from "@/lib/item-schema";
import { carryListingContext } from "@/lib/listing-context";
import { useItemDraft } from "@/lib/useItemDraft";

type FieldErrors = Record<string, string>;

const controlClass =
  "min-h-11 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base outline-none focus:border-black/40 focus:ring-1 focus:ring-black/20 dark:border-white/20 dark:focus:border-white/50 dark:focus:ring-white/20 sm:min-h-0 sm:text-sm";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function conditionLabel(value: string): string {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

async function readResponseError(
  response: Response,
  fallback: string,
): Promise<string> {
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
    // Keep the supplied fallback for a non-JSON response.
  }
  return fallback;
}

function ErrorText({
  field,
  errors,
}: {
  field: string;
  errors: FieldErrors;
}) {
  return errors[field] ? (
    <p className="text-sm text-red-700 dark:text-red-400">{errors[field]}</p>
  ) : null;
}

export function EditListingForm({ item }: { item: ItemDto }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draft = useItemDraft(item);
  const [keywordDraft, setKeywordDraft] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);
  const listPrice = numberValue(draft.fields.listPrice);
  const purchasePrice = numberValue(draft.fields.purchasePrice);
  const margin = listPrice - purchasePrice;
  const previewItem = buildEditDraftItemDto(
    item,
    draft.fields,
    draft.photos.flatMap((photo): string[] =>
      photo.url === null ? [] : [photo.url],
    ),
  );
  const hasIncompletePhotos =
    draft.photos.length > 0 && draft.savablePhotoUrls === null;
  const canSave =
    draft.dirty &&
    draft.savablePhotoUrls !== null &&
    !isSaving &&
    !isDiscarding;
  const from = searchParams.get("from");
  const itemHref = from
    ? carryListingContext(`/listings/${item.id}`, { from })
    : `/listings/${item.id}`;
  const savedItemHref = `${itemHref}${itemHref.includes("?") ? "&" : "?"}saved=1`;

  useEffect(() => {
    if (!draft.dirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = true;
    }

    function handleDocumentClick(event: MouseEvent): void {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (
        anchor.dataset.draftGuarded === "true" ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.origin !== window.location.origin
      ) {
        return;
      }

      if (!window.confirm("You have unsaved changes. Leave without saving?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [draft.dirty]);

  function clearFieldError(field: keyof ItemDraftFields): void {
    setFieldErrors((current: FieldErrors): FieldErrors => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField<Key extends keyof ItemDraftFields>(
    field: Key,
  ): (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => void {
    return (event): void => {
      draft.setField(field, event.target.value as ItemDraftFields[Key]);
      clearFieldError(field);
      setSubmitError(null);
    };
  }

  function addKeyword(): void {
    const keyword = keywordDraft.trim();
    if (
      keyword === "" ||
      draft.fields.keywords.length >= 15 ||
      draft.fields.keywords.some(
        (existing: string): boolean =>
          existing.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
      )
    ) {
      return;
    }

    draft.setField("keywords", [...draft.fields.keywords, keyword]);
    clearFieldError("keywords");
    setKeywordDraft("");
  }

  function handleKeywordKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addKeyword();
  }

  async function handleDiscard(): Promise<void> {
    if (!draft.dirty || isSaving || isDiscarding) return;
    setIsDiscarding(true);
    setSubmitError(null);
    setFieldErrors({});
    setKeywordDraft("");

    const cleanup = await draft.discard();
    if (cleanup.failedUrls.length > 0) {
      setSubmitError(
        "Changes were discarded, but some unused uploads could not be cleaned up.",
      );
    }
    setIsDiscarding(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft.dirty || isSaving || isDiscarding) return;

    if (draft.photos.length === 0) {
      setSubmitError("Add at least one photo before saving.");
      return;
    }
    if (draft.savablePhotoUrls === null) {
      setSubmitError("Wait for every photo upload to finish before saving.");
      return;
    }

    const parsed = UpdateItemSchema.safeParse(
      buildItemUpdateInput(draft.fields, draft.savablePhotoUrls),
    );
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        const key = typeof field === "string" ? field : "form";
        if (errors[key] === undefined) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      setSubmitError(
        errors.photos ?? errors.form ?? "Check the highlighted listing fields.",
      );
      return;
    }

    setIsSaving(true);
    setFieldErrors({});
    setSubmitError(null);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", data: parsed.data }),
      });

      if (!response.ok) {
        setSubmitError(
          await readResponseError(
            response,
            `Saving failed with status ${response.status}.`,
          ),
        );
        return;
      }

      await draft.finalizeSave();
      router.push(savedItemHref);
      router.refresh();
    } catch {
      setSubmitError(
        "Could not reach the save service. Check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const marginNote =
    purchasePrice === 0
      ? "Required to track profit"
      : margin === 0
        ? "Break-even at list price"
        : `${formatMoney(margin)} margin before fees`;
  const marginClass =
    purchasePrice === 0
      ? "text-red-700 dark:text-red-400"
      : margin <= 0
        ? "text-amber-700 dark:text-amber-400"
        : "text-black/55 dark:text-white/55";

  return (
    <>
      <header className="sticky top-15 z-[9] border-b border-black/10 bg-background/90 backdrop-blur-sm dark:border-white/15">
        <div className="mx-auto flex min-h-15 w-full max-w-[1180px] items-center gap-2 px-4 py-2 sm:px-6">
          <Link
            href={itemHref}
            data-draft-guarded="true"
            onNavigate={(event): void => {
              if (
                draft.dirty &&
                !window.confirm(
                  "You have unsaved changes. Leave without saving?",
                )
              ) {
                event.preventDefault();
              }
            }}
            className="inline-flex min-h-11 shrink-0 items-center text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
          >
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline">&nbsp;Back to item</span>
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-5 w-px bg-black/15 dark:bg-white/20 sm:block"
          />
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
            Editing · {draft.fields.title}
          </h1>
          <span
            aria-live="polite"
            className={`hidden shrink-0 text-xs sm:inline ${
              draft.dirty
                ? "text-amber-700 dark:text-amber-400"
                : "text-black/45 dark:text-white/45"
            }`}
          >
            {draft.dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button
            type="button"
            disabled={!draft.dirty || isSaving || isDiscarding}
            onClick={(): void => void handleDiscard()}
            className="min-h-11 rounded-md border border-black/15 px-3 text-sm font-medium disabled:opacity-40 dark:border-white/20"
          >
            Discard
          </button>
          <button
            type="submit"
            form="edit-listing-form"
            disabled={!canSave}
            className="min-h-11 rounded-md bg-foreground px-3 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-35 sm:px-4"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      <form
        id="edit-listing-form"
        onSubmit={(event): void => void handleSubmit(event)}
        className={`mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 ${
          draft.dirty ? "pb-28" : "pb-10"
        }`}
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="min-w-0 max-w-[520px] flex-[1_1_440px] min-[1030px]:sticky min-[1030px]:top-[132px]">
            <PhotoManager
              photos={draft.photos}
              lastRemoval={draft.lastRemoval}
              disabled={isSaving || isDiscarding}
              onAddPhotos={draft.addPhotos}
              onUploadStarted={draft.markPhotoUploadStarted}
              onUploadSucceeded={draft.markPhotoUploadSucceeded}
              onUploadFailed={draft.markPhotoUploadFailed}
              onRemovePhoto={draft.removePhoto}
              onUndoRemove={draft.undoPhotoRemoval}
              onMovePhoto={draft.movePhoto}
              onSetCover={draft.setCover}
            />

            <section className="mt-3 rounded-xl border border-black/15 p-4 text-sm dark:border-white/20">
              <h2 className="font-semibold">Photo tips</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-black/60 dark:text-white/60">
                <li>Front, back, tag, and any flaw make a useful core set.</li>
                <li>The first photo becomes the cover everywhere.</li>
              </ul>
            </section>
          </div>

          <div className="min-w-0 flex-[1_1_520px] space-y-3">
            <section className="rounded-xl border border-black/15 p-5 dark:border-white/20 sm:p-6">
              <h2 className="font-semibold">Listing content</h2>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="edit-title" className="text-sm font-medium">
                    Title
                  </label>
                  <input
                    id="edit-title"
                    value={draft.fields.title}
                    onChange={updateField("title")}
                    className={controlClass}
                  />
                  <ErrorText field="title" errors={fieldErrors} />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-description"
                    className="text-sm font-medium"
                  >
                    Marketplace listing body
                  </label>
                  <textarea
                    id="edit-description"
                    rows={5}
                    value={draft.fields.description}
                    onChange={updateField("description")}
                    aria-describedby="edit-description-marketplace-help"
                    className={controlClass}
                  />
                  <p
                    id="edit-description-marketplace-help"
                    className="text-xs text-black/60 dark:text-white/60"
                  >
                    This is the text copied to Facebook, Depop and eBay.
                  </p>
                  <ErrorText field="description" errors={fieldErrors} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-list-price"
                      className="text-sm font-medium"
                    >
                      List price
                    </label>
                    <div className="flex items-center rounded-md border border-black/15 px-3 focus-within:border-black/40 dark:border-white/20 dark:focus-within:border-white/50">
                      <span className="text-black/45 dark:text-white/45">$</span>
                      <input
                        id="edit-list-price"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={draft.fields.listPrice}
                        onChange={updateField("listPrice")}
                        onWheel={(event): void => event.currentTarget.blur()}
                        className="min-h-11 min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none sm:min-h-0 sm:text-sm"
                      />
                    </div>
                    {item.priceLow !== null && item.priceHigh !== null && (
                      <p className="text-xs text-black/50 dark:text-white/50">
                        AI suggested {formatMoney(item.priceLow)}–
                        {formatMoney(item.priceHigh)}
                      </p>
                    )}
                    <ErrorText field="listPrice" errors={fieldErrors} />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="edit-purchase-price"
                      className="text-sm font-medium"
                    >
                      Purchase price
                    </label>
                    <div className="flex items-center rounded-md border border-black/15 px-3 focus-within:border-black/40 dark:border-white/20 dark:focus-within:border-white/50">
                      <span className="text-black/45 dark:text-white/45">$</span>
                      <input
                        id="edit-purchase-price"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={draft.fields.purchasePrice}
                        onChange={updateField("purchasePrice")}
                        onWheel={(event): void => event.currentTarget.blur()}
                        className="min-h-11 min-w-0 flex-1 bg-transparent px-2 py-2 text-base outline-none sm:min-h-0 sm:text-sm"
                      />
                    </div>
                    <p className={`text-xs ${marginClass}`}>{marginNote}</p>
                    <ErrorText field="purchasePrice" errors={fieldErrors} />
                  </div>
                </div>
              </div>
            </section>

            <CopyListingSection item={previewItem} className="mt-0" />

            <section className="rounded-xl border border-black/15 p-5 dark:border-white/20 sm:p-6">
              <h2 className="font-semibold">Item attributes</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["brand", "Brand"],
                    ["category", "Category"],
                    ["size", "Size"],
                    ["color", "Color"],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <label htmlFor={`edit-${field}`} className="text-sm font-medium">
                      {label}
                    </label>
                    <input
                      id={`edit-${field}`}
                      value={draft.fields[field]}
                      onChange={updateField(field)}
                      className={controlClass}
                    />
                    <ErrorText field={field} errors={fieldErrors} />
                  </div>
                ))}

                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-condition"
                    className="text-sm font-medium"
                  >
                    Condition
                  </label>
                  <select
                    id="edit-condition"
                    value={draft.fields.condition}
                    onChange={updateField("condition")}
                    className={controlClass}
                  >
                    {CONDITION_VALUES.map((condition) => (
                      <option key={condition} value={condition}>
                        {conditionLabel(condition)}
                      </option>
                    ))}
                  </select>
                  <ErrorText field="condition" errors={fieldErrors} />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-purchase-date"
                    className="text-sm font-medium"
                  >
                    Purchase date
                  </label>
                  <input
                    id="edit-purchase-date"
                    type="date"
                    value={draft.fields.purchaseDate}
                    onChange={updateField("purchaseDate")}
                    className={controlClass}
                  />
                  <ErrorText field="purchaseDate" errors={fieldErrors} />
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <label
                  htmlFor="edit-condition-notes"
                  className="text-sm font-medium"
                >
                  Condition notes
                </label>
                <textarea
                  id="edit-condition-notes"
                  rows={3}
                  value={draft.fields.conditionNotes}
                  onChange={updateField("conditionNotes")}
                  className={controlClass}
                />
                <ErrorText field="conditionNotes" errors={fieldErrors} />
              </div>

              <div className="mt-4 space-y-2">
                <label htmlFor="edit-keyword" className="text-sm font-medium">
                  Keywords
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.fields.keywords.map((keyword: string) => (
                    <span
                      key={keyword}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-black/10 bg-black/[.04] py-1 pl-3 pr-1.5 text-xs dark:border-white/10 dark:bg-white/[.06]"
                    >
                      {keyword}
                      <button
                        type="button"
                        disabled={isSaving || isDiscarding}
                        onClick={(): void =>
                          draft.setField(
                            "keywords",
                            draft.fields.keywords.filter(
                              (candidate: string): boolean =>
                                candidate !== keyword,
                            ),
                          )
                        }
                        aria-label={`Remove keyword ${keyword}`}
                        className="inline-flex size-7 items-center justify-center rounded-full text-black/50 hover:bg-black/[.06] dark:text-white/50 dark:hover:bg-white/[.08]"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </span>
                  ))}
                  {draft.fields.keywords.length < 15 && (
                    <input
                      id="edit-keyword"
                      value={keywordDraft}
                      onChange={(event): void =>
                        setKeywordDraft(event.target.value)
                      }
                      onKeyDown={handleKeywordKeyDown}
                      placeholder="add keyword…"
                      className="min-h-8 w-36 rounded-full border border-dashed border-black/20 bg-transparent px-3 text-xs outline-none focus:border-black/45 dark:border-white/25 dark:focus:border-white/55"
                    />
                  )}
                </div>
                <ErrorText field="keywords" errors={fieldErrors} />
              </div>

              <div className="mt-4 space-y-1.5">
                <label htmlFor="edit-notes" className="text-sm font-medium">
                  Private notes
                </label>
                <textarea
                  id="edit-notes"
                  rows={3}
                  value={draft.fields.notes}
                  onChange={updateField("notes")}
                  placeholder="Only you see this — where you sourced it, etc."
                  className={controlClass}
                />
                <ErrorText field="notes" errors={fieldErrors} />
              </div>
            </section>

            {(submitError !== null || hasIncompletePhotos) && (
              <div
                role="alert"
                className="rounded-lg border border-red-600/25 bg-red-600/[.05] px-4 py-3 text-sm text-red-700 dark:border-red-400/25 dark:text-red-400"
              >
                {submitError ??
                  "Wait for every photo upload to finish before saving."}
              </div>
            )}
          </div>
        </div>
      </form>

      {draft.dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-white/15">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
            <span className="text-sm text-black/60 dark:text-white/60">
              {draft.changeSummary}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isSaving || isDiscarding}
                onClick={(): void => void handleDiscard()}
                className="min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium disabled:opacity-40 dark:border-white/20"
              >
                Discard
              </button>
              <button
                type="submit"
                form="edit-listing-form"
                disabled={!canSave}
                className="min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

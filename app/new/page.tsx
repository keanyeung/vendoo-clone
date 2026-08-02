"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ControlledCopyListingSection } from "@/components/CopyListingSection";
import ItemForm from "@/components/ItemForm";
import { PhotoManager } from "@/components/item/PhotoManager";
import { useListingCopy } from "@/components/useListingCopy";
import { computeProfit, computeRoi } from "@/lib/analytics";
import type { Analysis } from "@/lib/analysis-schema";
import {
  buildCreateItemInput,
  buildDraftItemDto,
  createItemDraft,
  type DraftItemStatus,
  type ItemDraft,
} from "@/lib/item-draft";
import type { ItemDto } from "@/lib/item-dto";
import { CreateItemSchema } from "@/lib/item-schema";
import { formatUsageLine } from "@/lib/model-pricing";
import { STATUS_STYLES } from "@/lib/status-style";
import { usePhotoCollection } from "@/lib/usePhotoCollection";

type AnalysisUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
};

type AnalyzeResponse = {
  analysis: Analysis;
  usage: AnalysisUsage;
};

type FieldErrors = Record<string, string>;

const PREVIEW_TIMESTAMP = "1970-01-01T00:00:00.000Z";
const MOBILE_PLATFORM_LABELS = {
  FB_MARKETPLACE: "Facebook",
  DEPOP: "Depop",
  EBAY: "eBay",
} as const;
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function NewListingPage() {
  const photoCollection = usePhotoCollection([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [usage, setUsage] = useState<AnalysisUsage | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisKey, setAnalysisKey] = useState<number>(0);
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [savedItem, setSavedItem] = useState<ItemDto | null>(null);
  const [listedTodayCount, setListedTodayCount] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const uploadedUrlsKeyRef = useRef<string>(JSON.stringify([]));
  const listedTodayRequestRef = useRef(0);
  const readyPhotoUrls = photoCollection.photos.flatMap(
    (photo): string[] =>
      photo.status === "ready" && photo.url !== null ? [photo.url] : [],
  );
  const readyPhotoUrlsKey = JSON.stringify(readyPhotoUrls);
  const hasPhotos = readyPhotoUrls.length > 0;
  const hasAnalysis = analysis !== null && draft !== null;
  const purchasePriceValue =
    draft === null || draft.purchasePrice.trim() === ""
      ? Number.NaN
      : Number(draft.purchasePrice);
  const canSaveListed =
    Number.isFinite(purchasePriceValue) && purchasePriceValue >= 0;
  const previewItem =
    draft === null
      ? null
      : buildDraftItemDto(
          draft,
          "preview",
          "LISTED",
          PREVIEW_TIMESTAMP,
        );
  const copyItem = savedItem ?? previewItem;
  const listingCopy = useListingCopy(copyItem);
  const listingCopyResetRef = useRef(listingCopy.reset);
  const usageLine = usage === null ? null : formatUsageLine(usage);

  useEffect((): void => {
    listingCopyResetRef.current = listingCopy.reset;
  }, [listingCopy.reset]);

  useEffect((): void => {
    if (uploadedUrlsKeyRef.current === readyPhotoUrlsKey) return;
    uploadedUrlsKeyRef.current = readyPhotoUrlsKey;
    setAnalysis(null);
    setDraft(null);
    setUsage(null);
    setErrorMessage(null);
    setIsAnalyzing(false);
    listingCopyResetRef.current();
  }, [readyPhotoUrlsKey]);

  async function handleAnalyze(): Promise<void> {
    if (readyPhotoUrls.length === 0 || isAnalyzing) return;
    const requestedUrls = [...readyPhotoUrls];
    const requestedUrlsKey = JSON.stringify(requestedUrls);
    uploadedUrlsKeyRef.current = requestedUrlsKey;
    setErrorMessage(null);
    setAnalysis(null);
    setUsage(null);
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls: requestedUrls }),
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
          setErrorMessage(
            `Analysis failed with status ${response.status}. Please try again.`,
          );
        }
        return;
      }
      if (!response.ok) {
        const message =
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : `Analysis failed with status ${response.status}. Please try again.`;
        if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
          setErrorMessage(message);
        }
        return;
      }
      if (
        !isRecord(body) ||
        !("analysis" in body) ||
        !isRecord(body.usage) ||
        typeof body.usage.inputTokens !== "number" ||
        typeof body.usage.outputTokens !== "number" ||
        typeof body.usage.model !== "string"
      ) {
        if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
          setErrorMessage("The analysis response was incomplete. Please try again.");
        }
        return;
      }
      if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
        const result = body as AnalyzeResponse;
        setAnalysis(result.analysis);
        setDraft(createItemDraft(result.analysis, requestedUrls));
        listingCopy.reset();
        setUsage(result.usage);
        setAnalysisKey((current: number): number => current + 1);
      }
    } catch {
      if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
        setErrorMessage(
          "Could not reach the analysis service. Check your connection and try again.",
        );
      }
    } finally {
      if (uploadedUrlsKeyRef.current === requestedUrlsKey) {
        setIsAnalyzing(false);
      }
    }
  }

  async function loadListedTodayCount(): Promise<void> {
    const requestId = listedTodayRequestRef.current + 1;
    listedTodayRequestRef.current = requestId;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    try {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });
      const response = await fetch(`/api/items/created-today?${params}`);
      const body: unknown = await response.json();
      if (
        response.ok &&
        isRecord(body) &&
        typeof body.count === "number"
      ) {
        if (listedTodayRequestRef.current === requestId) {
          setListedTodayCount(body.count);
        }
      }
    } catch {
      // Saving succeeded; a secondary metric failing must not replace the
      // confirmation with an error.
    }
  }

  function handleSaved(item: ItemDto): void {
    setSavedItem(item);
    setListedTodayCount(null);
    void loadListedTodayCount();
  }

  function updateDraft<Key extends keyof ItemDraft>(
    field: Key,
    value: ItemDraft[Key],
  ): void {
    listingCopy.clearFeedback();
    setFieldErrors((current: FieldErrors): FieldErrors => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmitError(null);
    setDraft((current: ItemDraft | null): ItemDraft | null =>
      current === null ? null : { ...current, [field]: value },
    );
  }

  async function handleSave(status: DraftItemStatus): Promise<void> {
    if (draft === null || isSaving) return;
    if (photoCollection.savablePhotoUrls === null) {
      setFieldErrors({
        photos: "Wait for every photo to finish uploading before saving.",
      });
      return;
    }

    const parsed = CreateItemSchema.safeParse(
      buildCreateItemInput(
        { ...draft, photos: photoCollection.savablePhotoUrls },
        status,
      ),
    );
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
    listingCopy.reset();
    setIsSaving(true);
    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : `Saving failed with status ${response.status}.`;
        setSubmitError(message);
        return;
      }
      if (!isRecord(body) || typeof body.id !== "string") {
        setSubmitError("The save response was incomplete. Please try again.");
        return;
      }

      handleSaved(
        buildDraftItemDto(
          draft,
          body.id,
          status,
          new Date().toISOString(),
        ),
      );
    } catch {
      setSubmitError(
        "Could not reach the save service. Check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleCreateAnother(): void {
    listedTodayRequestRef.current += 1;
    setSavedItem(null);
    setListedTodayCount(null);
    setAnalysis(null);
    setDraft(null);
    setUsage(null);
    setErrorMessage(null);
    setIsAnalyzing(false);
    setIsSaving(false);
    setFieldErrors({});
    setSubmitError(null);
    uploadedUrlsKeyRef.current = JSON.stringify([]);
    photoCollection.reset();
  }

  if (!savedItem) {
    return (
      <>
        <main
          className={`mx-auto w-full max-w-[1120px] flex-1 px-4 pt-6 sm:px-6 lg:pt-8 lg:pb-16 ${
            hasAnalysis ? "pb-32" : "pb-16"
          }`}
        >
          <div className="flex items-start justify-between gap-4 lg:items-end">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                New listing
              </h1>
              <p
                className={`mt-1 text-sm text-black/60 dark:text-white/60 ${
                  hasAnalysis ? "hidden lg:block" : ""
                }`}
              >
                Copy the text into Facebook, Depop or eBay, then save the item
                here.
              </p>
              <ol
                aria-label="Listing progress"
                className={`mt-3 items-center gap-2 text-xs font-medium text-black/60 dark:text-white/60 ${
                  hasAnalysis ? "hidden lg:flex" : "flex"
                }`}
              >
                <li className="text-foreground">
                  Photos{hasPhotos ? " ✓" : ""}
                </li>
                <li aria-hidden="true">›</li>
                <li className={hasPhotos ? "text-foreground" : undefined}>
                  Analyzed{hasAnalysis ? " ✓" : ""}
                </li>
                <li aria-hidden="true">›</li>
                <li
                  aria-current={hasAnalysis ? "step" : undefined}
                  className={hasAnalysis ? "text-foreground" : undefined}
                >
                  Post &amp; save
                </li>
              </ol>
            </div>

            {analysis && draft && previewItem && (
              <div className="flex shrink-0 items-center gap-3">
              {usageLine && (
                <p className="hidden text-right text-xs text-black/60 dark:text-white/60 lg:block">
                  {usageLine}
                </p>
              )}
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => void handleAnalyze()}
                className="min-h-11 rounded-md border border-black/15 px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
              >
                Re-analyze
              </button>
              <button
                type="submit"
                form="item-form"
                name="status"
                value="LISTED"
                disabled={isSaving || !canSaveListed}
                className="hidden min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60 lg:inline-flex lg:items-center"
              >
                {isSaving ? "Saving…" : "Save as listed"}
              </button>
              </div>
            )}
          </div>

          <div
            className={`mt-5 grid items-start gap-4 ${
              hasAnalysis
                ? "lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]"
                : "max-w-3xl"
            }`}
          >
            <div className="flex min-w-0 flex-col gap-4 lg:self-stretch">
              <PhotoManager
                photos={photoCollection.photos}
                lastRemoval={photoCollection.lastRemoval}
                reuploadOnUndo
                onAddPhotos={photoCollection.addPhotos}
                onUploadStarted={photoCollection.markPhotoUploadStarted}
                onUploadSucceeded={photoCollection.markPhotoUploadSucceeded}
                onUploadFailed={photoCollection.markPhotoUploadFailed}
                onRemovePhoto={photoCollection.removePhoto}
                onUndoRemove={photoCollection.undoPhotoRemoval}
                onMovePhoto={photoCollection.movePhoto}
                onSetCover={photoCollection.setCover}
              />
              {photoCollection.cleanupError !== null && (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
                >
                  <p>{photoCollection.cleanupError}</p>
                  <button
                    type="button"
                    onClick={photoCollection.dismissCleanupError}
                    className="min-h-11 shrink-0 font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {analysis && draft && previewItem && (
                <ControlledCopyListingSection
                  item={previewItem}
                  copy={listingCopy}
                  hideCopyActionsOnMobile
                  className="mt-0 lg:sticky lg:top-20"
                />
              )}

              {readyPhotoUrls.length > 0 && !hasAnalysis && (
                <section className="space-y-4">
                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => void handleAnalyze()}
                    className="min-h-11 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Analyze photos
                  </button>
                  {isAnalyzing && (
                    <div
                      aria-live="polite"
                      className="rounded-xl border border-black/15 bg-black/[.03] p-4 dark:border-white/20 dark:bg-white/[.04]"
                    >
                      <p className="font-medium">
                        Analyzing {readyPhotoUrls.length}{" "}
                        {readyPhotoUrls.length === 1 ? "photo" : "photos"}…
                      </p>
                      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                        This usually takes 15–30 seconds. You can keep this page
                        open while the listing draft is prepared.
                      </p>
                    </div>
                  )}
                  {errorMessage && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
                    >
                      <p>{errorMessage}</p>
                      <div className="flex shrink-0 gap-3 font-medium">
                        <button
                          type="button"
                          disabled={isAnalyzing}
                          onClick={() => void handleAnalyze()}
                          className="disabled:opacity-60"
                        >
                          Try again
                        </button>
                        <button
                          type="button"
                          onClick={() => setErrorMessage(null)}
                          aria-label="Dismiss analysis error"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            {analysis && draft && previewItem && (
              <ItemForm
                key={analysisKey}
                draft={draft}
                fieldErrors={fieldErrors}
                submitError={submitError}
              isSaving={isSaving}
              canSaveListed={canSaveListed}
                onChange={updateDraft}
                onSubmit={(status) => void handleSave(status)}
                onDismissSubmitError={() => setSubmitError(null)}
              />
            )}
          </div>

          {hasAnalysis && usageLine && (
            <p className="mt-4 text-center text-xs text-black/60 dark:text-white/60 lg:hidden">
              {usageLine}
            </p>
          )}
        </main>

        {analysis && draft && previewItem && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/15 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm dark:border-white/20 lg:hidden">
            <div className="mx-auto flex max-w-[1120px] gap-3 p-4">
              <button
                type="button"
                onClick={() => void listingCopy.copyListing()}
                className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-md bg-foreground px-4 text-base font-semibold text-background"
              >
                {listingCopy.copiedTarget === "listing"
                  ? "Copied"
                  : `Copy for ${
                      MOBILE_PLATFORM_LABELS[listingCopy.selectedPlatform]
                    }`}
              </button>
              <button
                type="submit"
                form="item-form"
                name="status"
                value="LISTED"
                disabled={isSaving || !canSaveListed}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md border border-black/15 px-5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  const savedStatus = STATUS_STYLES[savedItem.status];
  const potentialSale = {
    soldPrice: savedItem.listPrice,
    purchasePrice: savedItem.purchasePrice,
    platformFees: 0,
  };
  const potentialProfit = computeProfit(potentialSale);
  const potentialRoi = computeRoi(potentialSale);
  const savedMeta = [
    savedItem.category,
    savedItem.size,
    `listed at ${currency.format(savedItem.listPrice)}`,
    `paid ${currency.format(savedItem.purchasePrice)}`,
  ]
    .filter((value: string | null): value is string => value !== null)
    .join(" · ");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8 pb-16 sm:px-6">
      <section className="rounded-xl border border-black/15 bg-black/[.02] p-5 dark:border-white/20 dark:bg-white/[.02] sm:p-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-green-100 font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300"
          >
            ✓
          </span>
          <h1 className="text-xl font-semibold">Item saved</h1>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-lg border border-black/10 p-3 dark:border-white/15">
          {savedItem.photos[0] ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={savedItem.photos[0]}
              alt=""
              className="size-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div
              aria-hidden="true"
              className="size-14 shrink-0 rounded-lg bg-black/[.05] dark:bg-white/[.06]"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{savedItem.title}</p>
            <p className="mt-1 text-xs leading-5 text-black/55 dark:text-white/55">
              {savedMeta}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${savedStatus.className}`}
          >
            {savedStatus.label}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15">
          <div>
            <dt className="text-[11px] font-medium tracking-[0.06em] text-black/50 uppercase dark:text-white/50">
              Potential profit
            </dt>
            <dd
              className={`mt-1 text-xl font-semibold ${
                potentialProfit === null
                  ? ""
                  : potentialProfit >= 0
                    ? "text-green-700 dark:text-green-400"
                    : "text-red-700 dark:text-red-400"
              }`}
            >
              {potentialProfit === null
                ? "—"
                : currency.format(potentialProfit)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium tracking-[0.06em] text-black/50 uppercase dark:text-white/50">
              ROI
            </dt>
            <dd className="mt-1 text-xl font-semibold">
              {potentialRoi === null ? "—" : `${potentialRoi.toFixed(1)}%`}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium tracking-[0.06em] text-black/50 uppercase dark:text-white/50">
              Listed today
            </dt>
            <dd
              aria-live="polite"
              className="mt-1 text-xl font-semibold"
            >
              {listedTodayCount ?? "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreateAnother}
            className="min-h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background"
          >
            Create another
          </button>
          <Link
            href={`/listings/${savedItem.id}`}
            className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            View item
          </Link>
          <Link
            href="/listings"
            className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
          >
            All listings
          </Link>
        </div>
      </section>
    </main>
  );
}

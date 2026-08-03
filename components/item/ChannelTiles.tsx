"use client";

import { useState } from "react";

import { ControlledCopyListingSection } from "@/components/CopyListingSection";
import {
  type ListingCopyController,
  useListingCopy,
} from "@/components/useListingCopy";
import type { ItemDto, ItemPostingDto } from "@/lib/item-dto";
import {
  type ListingPlatform,
  PLATFORM_LABELS,
} from "@/lib/listing-text";
import { POSTING_PLATFORMS, postingSummary } from "@/lib/postings";

type PendingAction = {
  platform: ListingPlatform;
  action: "copy" | "remove" | "link";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isListingPlatform(value: unknown): value is ListingPlatform {
  return POSTING_PLATFORMS.some((platform) => platform === value);
}

function postingFromResponse(value: unknown): ItemPostingDto | null {
  if (!isRecord(value) || !isRecord(value.posting)) return null;
  const posting = value.posting;
  if (
    typeof posting.id !== "string" ||
    typeof posting.itemId !== "string" ||
    !isListingPlatform(posting.platform) ||
    typeof posting.postedAt !== "string" ||
    !(posting.url === null || typeof posting.url === "string") ||
    !(posting.removedAt === null || typeof posting.removedAt === "string")
  ) {
    return null;
  }
  return posting as ItemPostingDto;
}

async function responseError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.error === "string") return body.error;
  } catch {
    // Keep the status-based fallback for a non-JSON response.
  }
  return `${fallback} failed with status ${response.status}.`;
}

function postedDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function replacePosting(
  postings: ItemPostingDto[],
  replacement: ItemPostingDto,
): ItemPostingDto[] {
  return [
    ...postings.filter(
      (posting) => posting.platform !== replacement.platform,
    ),
    replacement,
  ];
}

export function ChannelTiles({
  item,
  copy,
}: {
  item: ItemDto;
  copy: ListingCopyController;
}) {
  const [postings, setPostings] = useState<ItemPostingDto[]>(item.postings);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [linkPlatform, setLinkPlatform] =
    useState<ListingPlatform | null>(null);
  const [linkValue, setLinkValue] = useState("");

  function clearErrors(): void {
    setActionError(null);
    copy.dismissError();
  }

  async function copyAndMaybePost(
    platform: ListingPlatform,
    shouldMarkPosted: boolean,
  ): Promise<void> {
    if (pending !== null) return;
    clearErrors();
    setPending({ platform, action: "copy" });

    try {
      const copied = await copy.copyCompleteListing(platform);
      if (!copied || !shouldMarkPosted) return;

      const response = await fetch(
        `/api/items/${encodeURIComponent(item.id)}/postings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform }),
        },
      );
      if (!response.ok) {
        setActionError(
          `${await responseError(response, "Recording the posting")} The listing was copied but not marked posted.`,
        );
        return;
      }

      const body: unknown = await response.json();
      const posting = postingFromResponse(body);
      if (posting === null) {
        setActionError(
          "The listing was copied, but the posting response was incomplete.",
        );
        return;
      }
      setPostings((current) => replacePosting(current, posting));
    } catch {
      setActionError(
        "The listing was copied, but the posting service could not be reached.",
      );
    } finally {
      setPending(null);
    }
  }

  async function markRemoved(platform: ListingPlatform): Promise<void> {
    if (pending !== null) return;
    clearErrors();
    setPending({ platform, action: "remove" });

    try {
      const response = await fetch(
        `/api/items/${encodeURIComponent(item.id)}/postings`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform }),
        },
      );
      if (!response.ok) {
        setActionError(await responseError(response, "Removing the posting"));
        return;
      }

      setPostings((current) =>
        current.map((posting) =>
          posting.platform === platform
            ? { ...posting, removedAt: new Date().toISOString() }
            : posting,
        ),
      );
      if (linkPlatform === platform) setLinkPlatform(null);
    } catch {
      setActionError(
        "Could not reach the posting service. The posting was not removed.",
      );
    } finally {
      setPending(null);
    }
  }

  async function saveLink(platform: ListingPlatform): Promise<void> {
    if (pending !== null) return;
    clearErrors();
    setPending({ platform, action: "link" });

    try {
      const response = await fetch(
        `/api/items/${encodeURIComponent(item.id)}/postings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, url: linkValue.trim() }),
        },
      );
      if (!response.ok) {
        setActionError(await responseError(response, "Saving the link"));
        return;
      }

      const body: unknown = await response.json();
      const posting = postingFromResponse(body);
      if (posting === null) {
        setActionError("The saved-link response was incomplete. Please try again.");
        return;
      }
      setPostings((current) => replacePosting(current, posting));
      setLinkPlatform(null);
      setLinkValue("");
    } catch {
      setActionError("Could not reach the posting service. The link was not saved.");
    } finally {
      setPending(null);
    }
  }

  const visibleError = copy.error ?? actionError;

  return (
    <section aria-labelledby="channels-heading" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="channels-heading" className="text-lg font-semibold">
            Marketplace channels
          </h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Copy a ready-to-paste listing and track where it is live.
          </p>
        </div>
        <p className="text-sm font-medium text-black/60 dark:text-white/60">
          {postingSummary(postings)}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {POSTING_PLATFORMS.map((platform) => {
          const posting = postings.find(
            (candidate) =>
              candidate.platform === platform && candidate.removedAt === null,
          );
          const isPosted = posting !== undefined;
          const platformPending = pending?.platform === platform;
          const wasJustCopied =
            copy.copiedTarget === "complete" &&
            copy.selectedPlatform === platform;

          return (
            <article
              key={platform}
              className="flex min-w-0 flex-col rounded-xl border border-black/15 p-4 dark:border-white/20"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{PLATFORM_LABELS[platform]}</h3>
                <span
                  aria-label={isPosted ? "Currently posted" : "Not posted"}
                  className={`mt-1 size-2.5 shrink-0 rounded-full ${
                    isPosted
                      ? "bg-green-600 dark:bg-green-400"
                      : "bg-black/20 dark:bg-white/25"
                  }`}
                />
              </div>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                {posting === undefined
                  ? "Not posted"
                  : `Posted ${postedDate(posting.postedAt)}`}
              </p>

              <div className="mt-4 flex flex-1 flex-col justify-end gap-2">
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() =>
                    void copyAndMaybePost(platform, posting === undefined)
                  }
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-foreground px-3 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {platformPending && pending?.action === "copy"
                    ? "Copying…"
                    : wasJustCopied
                      ? "✓ Copied"
                      : isPosted
                        ? "Copy again"
                        : "Copy & mark posted"}
                </button>

                {posting !== undefined && (
                  <>
                    {posting.url !== null && (
                      <a
                        href={posting.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
                      >
                        View listing ↗
                      </a>
                    )}

                    {linkPlatform === platform ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveLink(platform);
                        }}
                        className="space-y-2"
                      >
                        <label
                          htmlFor={`posting-link-${platform}`}
                          className="text-xs font-medium"
                        >
                          Listing URL
                        </label>
                        <input
                          id={`posting-link-${platform}`}
                          type="url"
                          required
                          autoFocus
                          value={linkValue}
                          onChange={(event) => setLinkValue(event.target.value)}
                          placeholder="https://…"
                          className="min-h-11 w-full rounded-md border border-black/15 bg-transparent px-3 text-base outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={pending !== null}
                            className="min-h-11 flex-1 rounded-md border border-black/15 px-3 text-sm font-medium disabled:opacity-60 dark:border-white/20"
                          >
                            {platformPending && pending?.action === "link"
                              ? "Saving…"
                              : "Save link"}
                          </button>
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() => setLinkPlatform(null)}
                            className="min-h-11 px-2 text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => {
                          clearErrors();
                          setLinkValue(posting.url ?? "");
                          setLinkPlatform(platform);
                        }}
                        className="min-h-11 w-fit text-left text-sm font-medium underline underline-offset-4 disabled:opacity-60"
                      >
                        {posting.url === null ? "Add link" : "Edit link"}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={pending !== null}
                      onClick={() => void markRemoved(platform)}
                      className="min-h-11 w-full rounded-md border border-black/15 px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
                    >
                      {platformPending && pending?.action === "remove"
                        ? "Removing…"
                        : "Mark as removed"}
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {visibleError !== null && (
        <div
          role="alert"
          className="mt-4 flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
        >
          <p>{visibleError}</p>
          <button
            type="button"
            onClick={clearErrors}
            className="min-h-11 shrink-0 font-medium"
            aria-label="Dismiss channel error"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}

export function ListingChannels({ item }: { item: ItemDto }) {
  const copy = useListingCopy(item);

  return (
    <>
      <ChannelTiles item={item} copy={copy} />
      <ControlledCopyListingSection
        item={item}
        copy={copy}
        showCopyError={false}
        className="mt-4"
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useItemDetail } from "@/components/item/ItemDetailProvider";
import QuickEditField from "@/components/item/QuickEditField";
import type { ItemDto } from "@/lib/item-dto";
import {
  buildListingsHref,
  carryListingContext,
} from "@/lib/listing-context";
import { DETAIL_STATUS_STYLES } from "@/lib/status-style";

type StatusAction = {
  buttonLabel: string;
  nextStatus: "DRAFT" | "LISTED";
};

export type ItemListNavigation = {
  previousId: string | null;
  nextId: string | null;
  position: number | null;
  total: number;
};

const statusActions = {
  DRAFT: {
    buttonLabel: "Mark as listed",
    nextStatus: "LISTED",
  },
  LISTED: {
    buttonLabel: "Move to draft",
    nextStatus: "DRAFT",
  },
  SOLD: {
    buttonLabel: "Mark as not sold",
    nextStatus: "LISTED",
  },
} satisfies Record<ItemDto["status"], StatusAction>;

async function readError(
  response: Response,
  fallbackAction: string,
): Promise<string> {
  let message = `${fallbackAction} failed with status ${response.status}.`;

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

  return message;
}

export function ItemActionBar({
  item,
  from = null,
  navigation = null,
}: {
  item: ItemDto;
  from?: string | null;
  navigation?: ItemListNavigation | null;
}) {
  const router = useRouter();
  const { setSellOpen } = useItemDetail();
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const status = DETAIL_STATUS_STYLES[item.status];
  const statusAction = statusActions[item.status];
  const contextParams = { from: from ?? undefined };
  const backHref = from ? buildListingsHref(contextParams) : "/listings";
  const editHref = from
    ? carryListingContext(`/listings/${item.id}/edit`, contextParams)
    : `/listings/${item.id}/edit`;
  const previousHref =
    from && navigation?.previousId
      ? carryListingContext(
          `/listings/${navigation.previousId}`,
          contextParams,
        )
      : null;
  const nextHref =
    from && navigation?.nextId
      ? carryListingContext(`/listings/${navigation.nextId}`, contextParams)
      : null;

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleMouseDown(event: MouseEvent): void {
      if (
        menuContainerRef.current !== null &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (dialog === null) return;

    if (isDeleteOpen && !dialog.open) dialog.showModal();
    else if (!isDeleteOpen && dialog.open) dialog.close();
  }, [isDeleteOpen]);

  useEffect(() => {
    if (!from || navigation === null) return;

    function handleListNavigationKey(event: KeyboardEvent): void {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        document.querySelector("dialog[open]") !== null
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }

      const href =
        event.key === "["
          ? previousHref
          : event.key === "]"
            ? nextHref
            : null;
      if (href === null) return;

      event.preventDefault();
      router.push(href);
    }

    document.addEventListener("keydown", handleListNavigationKey);
    return () => document.removeEventListener("keydown", handleListNavigationKey);
  }, [from, navigation, nextHref, previousHref, router]);

  function scrollToSellSection(): void {
    requestAnimationFrame(() => {
      document
        .getElementById("sell")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openSell(): void {
    setSellOpen(true);
    scrollToSellSection();
  }

  async function handleStatusChange(): Promise<void> {
    if (isPending) return;

    setIsMenuOpen(false);
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          data: { status: statusAction.nextStatus },
        }),
      });

      if (!response.ok) {
        setError(await readError(response, "Status update"));
        return;
      }

      router.refresh();
    } catch {
      setError(
        "Could not reach the item service. Check your connection and try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleDuplicate(): Promise<void> {
    if (isPending) return;

    setIsMenuOpen(false);
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(
        `/api/items/${encodeURIComponent(item.id)}/duplicate`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readError(response, "Duplication"));
        return;
      }

      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // The shape check below provides the user-facing error.
      }
      if (
        typeof body !== "object" ||
        body === null ||
        !("id" in body) ||
        typeof body.id !== "string"
      ) {
        setError("The duplicate response was incomplete. Please try again.");
        return;
      }

      router.push(`/new?draft=${encodeURIComponent(body.id)}`);
    } catch {
      setError(
        "Could not reach the item service. Check your connection and try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (isPending) return;

    setError(null);
    setIsPending(true);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await readError(response, "Deletion"));
        setIsDeleteOpen(false);
        return;
      }

      // Leave the deleted detail route before refreshing the listings grid.
      router.push(backHref);
      router.refresh();
    } catch {
      setError(
        "Could not reach the item service. Check your connection and try again.",
      );
      setIsDeleteOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  function closeDeleteDialog(): void {
    if (!isPending) setIsDeleteOpen(false);
  }

  return (
    <div className="sticky top-15 z-[9] border-b border-black/10 bg-background/90 backdrop-blur-sm dark:border-white/15">
      <div className="mx-auto flex min-h-15 w-full max-w-[1120px] flex-wrap items-center gap-1.5 px-4 py-2 sm:gap-2 sm:px-6">
        <Link
          href={backHref}
          aria-label="Back to listings"
          className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white sm:w-auto sm:justify-start"
        >
          <span aria-hidden="true">←</span>
          <span className="sr-only sm:not-sr-only">&nbsp;Listings</span>
        </Link>

        <span
          aria-hidden="true"
          className="hidden h-5 w-px shrink-0 bg-black/15 dark:bg-white/20 sm:block"
        />

        {from && navigation !== null && (
          <nav
            aria-label="Items in current listings view"
            className="order-last flex w-full basis-full items-center justify-center border-t border-black/10 pt-2 dark:border-white/15 sm:order-none sm:w-auto sm:basis-auto sm:border-t-0 sm:pt-0"
          >
            {previousHref === null ? (
              <button
                type="button"
                disabled
                aria-label="Previous item in listings"
                className="inline-flex min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded-md text-black/30 dark:text-white/30"
              >
                <span aria-hidden="true">←</span>
              </button>
            ) : (
              <Link
                href={previousHref}
                aria-label="Previous item in listings"
                title="Previous item ([)"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                <span aria-hidden="true">←</span>
              </Link>
            )}
            <span className="min-w-16 text-center text-xs tabular-nums text-black/60 dark:text-white/60">
              <span aria-hidden="true">
                {navigation.position ?? "—"} of {navigation.total}
              </span>
              <span className="sr-only">
                {navigation.position === null
                  ? `Current item is not in this list of ${navigation.total} items`
                  : `Item ${navigation.position} of ${navigation.total}`}
              </span>
            </span>
            {nextHref === null ? (
              <button
                type="button"
                disabled
                aria-label="Next item in listings"
                className="inline-flex min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded-md text-black/30 dark:text-white/30"
              >
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <Link
                href={nextHref}
                aria-label="Next item in listings"
                title="Next item (])"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-black/[.04] dark:hover:bg-white/[.06]"
              >
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </nav>
        )}

        <QuickEditField
          field="title"
          label="Title"
          as="h1"
          containerClassName="min-w-0 flex-1"
          valueClassName="truncate text-sm font-semibold sm:text-base"
          inputClassName="text-sm font-semibold sm:text-base"
        />

        <span
          className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:inline ${status.className}`}
        >
          {status.label}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {item.status !== "SOLD" && (
            <button
              type="button"
              onClick={openSell}
              className="min-h-11 rounded-md bg-foreground px-2.5 text-sm font-medium text-background sm:px-3.5"
            >
              Mark as sold
            </button>
          )}
          <Link
            href={editHref}
            className="hidden min-h-11 items-center rounded-md border border-black/15 px-3.5 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06] sm:inline-flex"
          >
            Edit
          </Link>

          <div ref={menuContainerRef} className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              disabled={isPending}
              aria-label="More item actions"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className="flex size-11 items-center justify-center rounded-md border border-black/15 text-xl leading-none hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/[.06]"
            >
              <span aria-hidden="true">⋯</span>
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-lg border border-black/15 bg-background p-1.5 shadow-xl dark:border-white/20"
              >
                <Link
                  href={editHref}
                  role="menuitem"
                  onClick={(event) => {
                    if (isPending) {
                      event.preventDefault();
                      return;
                    }
                    setIsMenuOpen(false);
                  }}
                  aria-disabled={isPending}
                  tabIndex={isPending ? -1 : undefined}
                  className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-black/[.05] dark:hover:bg-white/[.07] ${
                    isPending ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  Edit item
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleDuplicate()}
                  disabled={isPending}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/[.07]"
                >
                  {isPending ? "Duplicating…" : "Duplicate as new listing"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleStatusChange()}
                  disabled={isPending}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/[.07]"
                >
                  {statusAction.buttonLabel}
                </button>
                <div className="my-1 border-t border-black/10 dark:border-white/15" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsDeleteOpen(true);
                  }}
                  disabled={isPending}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium text-red-700 hover:bg-red-600/[.06] disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400"
                >
                  Delete item
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-3 sm:px-6">
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-background px-3 py-2 text-sm text-red-700 shadow-sm dark:border-red-400/30 dark:text-red-400"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              disabled={isPending}
              className="min-h-11 shrink-0 font-medium disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Dismiss item management error"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <dialog
        ref={deleteDialogRef}
        onClose={() => setIsDeleteOpen(false)}
        onCancel={(event) => {
          if (isPending) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget || isPending) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const inside =
            event.clientX >= bounds.left &&
            event.clientX <= bounds.right &&
            event.clientY >= bounds.top &&
            event.clientY <= bounds.bottom;
          if (!inside) closeDeleteDialog();
        }}
        className="item-delete-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-black/15 bg-background p-6 text-foreground shadow-xl dark:border-white/20"
      >
        <style>{`
          .item-delete-dialog::backdrop {
            background: rgb(0 0 0 / 0.55);
          }
        `}</style>
        <h2 className="text-lg font-semibold">Delete item?</h2>
        <p className="mt-3 text-sm leading-6 text-black/70 dark:text-white/70">
          This permanently deletes the item and removes photos that no other
          item uses. This cannot be undone.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={closeDeleteDialog}
            disabled={isPending}
            className="min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isPending}
            className="min-h-11 rounded-md bg-red-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:text-black"
          >
            {isPending ? "Deleting…" : "Confirm delete"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

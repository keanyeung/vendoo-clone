"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { UndoToast } from "@/components/UndoToast";
import { useListingsSelection } from "@/components/listings/ListingsSelectionProvider";

type MutableStatus = "DRAFT" | "LISTED";
type PendingAction = "status" | "delete" | "undo" | null;
type Feedback =
  | {
      kind: "undo";
      message: string;
      ids: string[];
      undoStatus: MutableStatus;
    }
  | {
      kind: "message";
      message: string;
      tone?: "default" | "error";
    };

type BulkRequestBody =
  | {
      action: "set_status";
      ids: string[];
      data: { status: MutableStatus };
    }
  | { action: "delete"; ids: string[] };

async function readResponseError(
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

async function postBulkAction(
  body: BulkRequestBody,
  fallbackAction: string,
): Promise<number> {
  const response = await fetch("/api/items/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readResponseError(response, fallbackAction));
  }

  const result: unknown = await response.json();
  if (
    typeof result !== "object" ||
    result === null ||
    !("count" in result) ||
    typeof result.count !== "number"
  ) {
    throw new Error(`${fallbackAction} returned an invalid response.`);
  }

  return result.count;
}

function itemCountLabel(count: number): string {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

export default function BulkActionBar() {
  const router = useRouter();
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const { selectedIds, selectedCount, clear } = useListingsSelection();
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const isPending = pendingAction !== null;

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (dialog === null) return;

    if (isDeleteOpen && !dialog.open) dialog.showModal();
    else if (!isDeleteOpen && dialog.open) dialog.close();
  }, [isDeleteOpen]);

  async function handleStatusChange(status: MutableStatus): Promise<void> {
    if (isPending || selectedCount === 0) return;

    const ids = Array.from(selectedIds);
    setPendingAction("status");
    setError(null);
    setFeedback(null);

    try {
      const count = await postBulkAction(
        { action: "set_status", ids, data: { status } },
        "Bulk status update",
      );
      const statusLabel = status === "DRAFT" ? "Draft" : "Listed";
      clear();
      setFeedback({
        kind: "undo",
        message: `Set ${itemCountLabel(count)} to ${statusLabel}.`,
        ids,
        undoStatus: status === "DRAFT" ? "LISTED" : "DRAFT",
      });
      router.refresh();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not reach the item service. Check your connection and try again.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUndo(): Promise<void> {
    if (isPending || feedback?.kind !== "undo") return;

    const { ids, undoStatus } = feedback;
    setPendingAction("undo");
    setError(null);

    try {
      const count = await postBulkAction(
        {
          action: "set_status",
          ids,
          data: { status: undoStatus },
        },
        "Undo",
      );
      setFeedback({
        kind: "message",
        message: `Undid the status change for ${itemCountLabel(count)}.`,
      });
      router.refresh();
    } catch (caught: unknown) {
      setFeedback({
        kind: "message",
        message:
          caught instanceof Error
            ? caught.message
            : "Could not reach the item service. Check your connection and try again.",
        tone: "error",
      });
    } finally {
      setPendingAction(null);
    }
  }

  function openDeleteDialog(): void {
    if (isPending || selectedCount === 0) return;
    setDeleteIds(Array.from(selectedIds));
    setError(null);
    setFeedback(null);
    setIsDeleteOpen(true);
  }

  function closeDeleteDialog(): void {
    if (!isPending) setIsDeleteOpen(false);
  }

  async function handleDelete(): Promise<void> {
    if (isPending || deleteIds.length === 0) return;

    setPendingAction("delete");
    setError(null);

    try {
      const count = await postBulkAction(
        { action: "delete", ids: deleteIds },
        "Bulk deletion",
      );
      setIsDeleteOpen(false);
      clear();
      setFeedback({
        kind: "message",
        message: `Deleted ${itemCountLabel(count)}.`,
      });
      router.refresh();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not reach the item service. Check your connection and try again.",
      );
      setIsDeleteOpen(false);
    } finally {
      setPendingAction(null);
    }
  }

  const showBar = selectedCount > 0 || error !== null;
  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

  return (
    <>
      {showBar && <div aria-hidden="true" className="h-28" />}

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-white/15">
          <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-2 px-4 sm:px-6">
            {selectedCount > 0 && (
              <>
                <span className="mr-auto text-sm font-medium">
                  {selectedCount} selected
                </span>
                <span aria-hidden="true" className="text-black/35 dark:text-white/35">
                  {"\u00b7"}
                </span>
                <select
                  aria-label={`Set status for ${itemCountLabel(selectedCount)}`}
                  value=""
                  onChange={(event) => {
                    const status = event.target.value;
                    if (status === "DRAFT" || status === "LISTED") {
                      void handleStatusChange(status);
                    }
                  }}
                  disabled={isPending}
                  className={`min-h-11 rounded-md border border-black/15 bg-background px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 ${focusRing}`}
                >
                  <option value="" disabled>
                    {pendingAction === "status" ? "Updating..." : "Set status"}
                  </option>
                  <option value="DRAFT">Draft</option>
                  <option value="LISTED">Listed</option>
                </select>
                <span aria-hidden="true" className="text-black/35 dark:text-white/35">
                  {"\u00b7"}
                </span>
                <button
                  type="button"
                  onClick={openDeleteDialog}
                  disabled={isPending}
                  className={`min-h-11 rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-600/[.07] disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 ${focusRing}`}
                >
                  Delete
                </button>
                <span aria-hidden="true" className="text-black/35 dark:text-white/35">
                  {"\u00b7"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clear();
                    setFeedback(null);
                    setError(null);
                  }}
                  disabled={isPending}
                  className={`min-h-11 rounded-md px-3 text-sm font-medium text-black/60 hover:bg-black/[.04] hover:text-black disabled:cursor-not-allowed disabled:opacity-60 dark:text-white/60 dark:hover:bg-white/[.06] dark:hover:text-white ${focusRing}`}
                >
                  Clear
                </button>
              </>
            )}

            {error !== null && (
              <div
                role="alert"
                className="flex w-full items-center justify-between gap-3 border-t border-red-600/20 pt-2 text-sm text-red-700 dark:border-red-400/20 dark:text-red-400"
              >
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  disabled={isPending}
                  className={`min-h-11 shrink-0 font-medium disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {feedback !== null && (
        <UndoToast
          message={feedback.message}
          onUndo={
            feedback.kind === "undo" ? () => void handleUndo() : undefined
          }
          onDismiss={() => setFeedback(null)}
          isUndoing={pendingAction === "undo"}
          tone={feedback.kind === "message" ? feedback.tone : undefined}
        />
      )}

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="bulk-delete-title"
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
        className="bulk-delete-dialog m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-black/15 bg-background p-6 text-foreground shadow-xl dark:border-white/20"
      >
        <style>{`
          .bulk-delete-dialog::backdrop {
            background: rgb(0 0 0 / 0.55);
          }
        `}</style>
        <h2 id="bulk-delete-title" className="text-lg font-semibold">
          Delete {itemCountLabel(deleteIds.length)}?
        </h2>
        <p className="mt-3 text-sm leading-6 text-black/70 dark:text-white/70">
          This permanently deletes the selected listings and removes their
          unshared photos from storage. This cannot be undone.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={closeDeleteDialog}
            disabled={isPending}
            className={`min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 ${focusRing}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isPending}
            className={`min-h-11 rounded-md bg-red-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:text-black ${focusRing}`}
          >
            {pendingAction === "delete" ? "Deleting..." : "Confirm delete"}
          </button>
        </div>
      </dialog>
    </>
  );
}

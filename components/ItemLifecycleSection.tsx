"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ItemDto } from "@/lib/item-dto";

export type ItemLifecycleSectionProps = {
  item: ItemDto;
};

type StatusAction = {
  currentLabel: string;
  buttonLabel: string;
  helperText: string;
  nextStatus: "DRAFT" | "LISTED";
};

const statusActions = {
  DRAFT: {
    currentLabel: "Draft",
    buttonLabel: "Mark as listed",
    helperText: "Moves this item into your active listings.",
    nextStatus: "LISTED",
  },
  LISTED: {
    currentLabel: "Listed",
    buttonLabel: "Move to draft",
    helperText: "Hides it from your active listings while you work on it.",
    nextStatus: "DRAFT",
  },
  SOLD: {
    currentLabel: "Sold",
    buttonLabel: "Mark as not sold",
    helperText:
      "Returns this item to Listed and clears the recorded sale (price, platform, date and fees).",
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

export default function ItemLifecycleSection({
  item,
}: ItemLifecycleSectionProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState<boolean>(false);
  const [isConfirmingDelete, setIsConfirmingDelete] =
    useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const statusAction = statusActions[item.status];

  async function handleStatusChange(): Promise<void> {
    if (isPending) return;

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
        return;
      }

      // Leave the deleted detail route before refreshing the listings grid.
      router.push("/listings");
      router.refresh();
    } catch {
      setError(
        "Could not reach the item service. Check your connection and try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-black/15 p-6 dark:border-white/20">
      <h2 className="text-lg font-semibold">Manage</h2>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            Currently: {statusAction.currentLabel}
          </p>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            {statusAction.helperText}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleStatusChange()}
          disabled={isPending}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {statusAction.buttonLabel}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start justify-between gap-3 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            disabled={isPending}
            className="shrink-0 font-medium disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Dismiss item management error"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-6 border-t border-black/10 pt-6 dark:border-white/15">
        {!isConfirmingDelete ? (
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            disabled={isPending}
            className="rounded-md border border-red-600/30 px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/30 dark:text-red-400"
          >
            Delete item
          </button>
        ) : (
          <div className="rounded-md border border-red-600/30 bg-red-600/[.06] p-4 dark:border-red-400/30">
            <p className="text-sm text-red-700 dark:text-red-400">
              This permanently deletes the item and removes its photos from
              storage. This cannot be undone.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-500 dark:text-black"
              >
                {isPending ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
                disabled={isPending}
                className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

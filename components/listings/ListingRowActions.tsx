"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import MarkSoldDialog from "@/components/MarkSoldDialog";
import { UndoToast } from "@/components/UndoToast";
import type { ListingRowDto } from "@/lib/item-dto";

type ListingRowActionsProps = {
  item: ListingRowDto;
  variant: "card" | "table";
  editHref: string;
};

type MutableStatus = "DRAFT" | "LISTED";
type SaleToastState = {
  message: string;
  tone?: "default" | "error";
  previousStatus?: "DRAFT" | "LISTED";
};

async function readResponseError(
  response: Response,
  fallbackAction: string,
): Promise<string> {
  let message = `${fallbackAction} failed (status ${response.status}).`;

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

export default function ListingRowActions(props: ListingRowActionsProps) {
  const { item, variant } = props;
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [sellItem, setSellItem] = useState<ListingRowDto | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [saleToast, setSaleToast] = useState<SaleToastState | null>(null);
  const [isUndoingSale, setIsUndoingSale] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;

    function closeOnOutsidePointer(event: PointerEvent): void {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      menuButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  async function changeStatus(status: MutableStatus): Promise<void> {
    if (pendingId) return;
    setPendingId(item.id);
    setActionError(null);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", data: { status } }),
      });

      if (!response.ok) {
        setActionError(await readResponseError(response, "Update"));
        return;
      }

      setIsMenuOpen(false);
      router.refresh();
    } catch {
      setActionError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function undoSale(): Promise<void> {
    if (isUndoingSale || saleToast === null) return;

    setIsUndoingSale(true);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          data: {
            status: saleToast.previousStatus ?? "LISTED",
          },
        }),
      });

      if (!response.ok) {
        setSaleToast({
          message: await readResponseError(response, "Undo"),
          tone: "error",
        });
        return;
      }

      setSaleToast(null);
      router.refresh();
    } catch {
      setSaleToast({
        message:
          "Could not reach the item service. The sale was not undone; try again.",
        tone: "error",
      });
    } finally {
      setIsUndoingSale(false);
    }
  }

  async function duplicateItem(): Promise<void> {
    if (pendingId || isDuplicating) return;

    setIsMenuOpen(false);
    setActionError(null);
    setIsDuplicating(true);

    try {
      const response = await fetch(
        `/api/items/${encodeURIComponent(item.id)}/duplicate`,
        { method: "POST" },
      );
      if (!response.ok) {
        setActionError(await readResponseError(response, "Duplication"));
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
        setActionError("The duplicate response was incomplete. Please try again.");
        return;
      }

      router.push(`/new?draft=${encodeURIComponent(body.id)}`);
    } catch {
      setActionError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setIsDuplicating(false);
    }
  }

  const isPending = pendingId === item.id || isDuplicating;
  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

  return (
    <>
      <div
        className={`flex items-center gap-2 ${
          variant === "card" ? "justify-between" : "justify-end"
        }`}
      >
          {item.status === "SOLD" ? (
            <button
              type="button"
              onClick={() => void changeStatus("LISTED")}
              disabled={isPending}
              className={`min-h-11 rounded-md bg-foreground font-medium text-background disabled:cursor-not-allowed disabled:opacity-60 ${
                variant === "card" ? "px-4 text-sm" : "px-3 text-xs"
              } ${focusRing}`}
            >
              {pendingId === item.id ? "Relisting…" : "Relist"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSellItem(item)}
              disabled={isPending}
              className={`min-h-11 rounded-md bg-foreground font-medium text-background disabled:cursor-not-allowed disabled:opacity-60 ${
                variant === "card" ? "px-4 text-sm" : "px-3 text-xs"
              } ${focusRing}`}
            >
              {variant === "card" ? "Mark sold" : "Sell"}
            </button>
          )}

          <div ref={menuRef} className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              disabled={isPending}
              aria-label={`More actions for ${item.title}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className={`flex size-11 items-center justify-center rounded-md border border-black/15 text-xl leading-none hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/[.06] ${focusRing}`}
            >
              <span aria-hidden="true">⋯</span>
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className={`absolute right-0 z-20 w-52 rounded-lg border border-black/15 bg-background p-1.5 text-left shadow-xl dark:border-white/20 ${
                  variant === "card" ? "bottom-full mb-2" : "top-full mt-2"
                }`}
              >
                {item.status !== "SOLD" && (
                  <label className="block px-3 py-2 text-xs font-medium text-black/60 dark:text-white/60">
                    Status
                    <select
                      aria-label={`Change status for ${item.title}`}
                      value={item.status}
                      onChange={(event) =>
                        void changeStatus(event.target.value as MutableStatus)
                      }
                      disabled={isPending}
                      className={`mt-1 block min-h-11 min-w-0 w-full rounded-md border border-black/15 bg-background px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 ${focusRing}`}
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="LISTED">Listed</option>
                    </select>
                  </label>
                )}
                <Link
                  href={props.editHref}
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-black/[.05] dark:hover:bg-white/[.07] ${focusRing}`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void duplicateItem()}
                  disabled={isPending}
                  className={`flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm font-medium hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/[.07] ${focusRing}`}
                >
                  {isDuplicating ? "Duplicating…" : "Duplicate as new listing"}
                </button>
              </div>
            )}
          </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className={`${variant === "card" ? "mt-2" : "mt-2 max-w-72 whitespace-normal text-left"} flex items-center justify-between gap-2 rounded-md border border-red-600/30 bg-red-600/[.06] px-3 py-1 text-sm text-red-700 dark:border-red-400/30 dark:text-red-400`}
        >
          <p>{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className={`min-h-11 shrink-0 font-medium ${focusRing}`}
            aria-label="Dismiss action error"
          >
            Dismiss
          </button>
        </div>
      )}

      <MarkSoldDialog
        item={sellItem}
        onClose={() => setSellItem(null)}
        onSold={() => {
          setSellItem(null);
          setSaleToast({
            message: `Marked ${item.title} as sold.`,
            previousStatus: item.status === "DRAFT" ? "DRAFT" : "LISTED",
          });
          router.refresh();
        }}
      />

      {saleToast !== null && (
        <UndoToast
          message={saleToast.message}
          onUndo={
            saleToast.tone === "error" ? undefined : () => void undoSale()
          }
          onDismiss={() => setSaleToast(null)}
          isUndoing={isUndoingSale}
          tone={saleToast.tone}
        />
      )}
    </>
  );
}

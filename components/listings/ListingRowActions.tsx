"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import MarkSoldDialog from "@/components/MarkSoldDialog";
import type { ListingRowDto } from "@/lib/item-dto";

type ListingRowActionsProps = {
  item: ListingRowDto;
} & (
  | { variant: "card"; editHref: string }
  | { variant: "table"; editHref?: never }
);

type MutableStatus = "DRAFT" | "LISTED";

export default function ListingRowActions(props: ListingRowActionsProps) {
  const { item, variant } = props;
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [sellItem, setSellItem] = useState<ListingRowDto | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        let message = `Update failed (status ${response.status}).`;
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
        setActionError(message);
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

  const isPending = pendingId === item.id;
  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

  return (
    <>
      {variant === "table" ? (
        item.status === "SOLD" ? (
          <button
            type="button"
            onClick={() => void changeStatus("LISTED")}
            disabled={isPending}
            className={`min-h-11 rounded-md border border-black/15 px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 ${focusRing}`}
          >
            {isPending ? "Relisting…" : "Relist"}
          </button>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <select
              aria-label={`Change status for ${item.title}`}
              value={item.status}
              onChange={(event) =>
                void changeStatus(event.target.value as MutableStatus)
              }
              disabled={isPending}
              className={`min-h-11 rounded-md border border-black/15 bg-transparent px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 ${focusRing}`}
            >
              <option value="DRAFT">Draft</option>
              <option value="LISTED">Listed</option>
            </select>
            <button
              type="button"
              onClick={() => setSellItem(item)}
              disabled={isPending}
              className={`min-h-11 rounded-md bg-foreground px-3 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
            >
              Mark sold
            </button>
          </div>
        )
      ) : (
        <div className="flex items-center justify-between gap-2">
          {item.status === "SOLD" ? (
            <button
              type="button"
              onClick={() => void changeStatus("LISTED")}
              disabled={isPending}
              className={`min-h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
            >
              {isPending ? "Relisting…" : "Relist"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSellItem(item)}
              disabled={isPending}
              className={`min-h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
            >
              Mark sold
            </button>
          )}

          <div ref={menuRef} className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label={`More actions for ${item.title}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className={`flex size-11 items-center justify-center rounded-md border border-black/15 text-xl leading-none hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06] ${focusRing}`}
            >
              <span aria-hidden="true">⋯</span>
            </button>

            {isMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 bottom-full z-20 mb-2 w-52 rounded-lg border border-black/15 bg-background p-1.5 text-left shadow-xl dark:border-white/20"
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
                      className={`mt-1 min-h-11 w-full rounded-md border border-black/15 bg-background px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/20 ${focusRing}`}
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
              </div>
            )}
          </div>
        </div>
      )}

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
          router.refresh();
        }}
      />
    </>
  );
}

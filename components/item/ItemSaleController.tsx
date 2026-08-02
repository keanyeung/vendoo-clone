"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import MarkSoldDialog from "@/components/MarkSoldDialog";
import { useItemDetail } from "@/components/item/ItemDetailProvider";
import { SaleToast } from "@/components/item/SaleToast";
import { computeProfit } from "@/lib/analytics";
import type { ItemDto } from "@/lib/item-dto";
import type { MarkSoldInput } from "@/lib/item-schema";

type ToastState = {
  message: string;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

async function responseError(response: Response): Promise<string> {
  let message = `Undo failed with status ${response.status}.`;

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

export function ItemSaleController({ item }: { item: ItemDto }) {
  const router = useRouter();
  const { isSellOpen, setSellOpen } = useItemDetail();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const mode = item.status === "SOLD" ? "edit" : "create";

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (toast === null) return;

    timerRef.current = setTimeout(() => {
      setToast(null);
      setUndoError(null);
      timerRef.current = null;
    }, 7000);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [toast]);

  function clearTimer(): void {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function dismissToast(): void {
    clearTimer();
    setToast(null);
    setUndoError(null);
  }

  function handleSold(sale: MarkSoldInput): void {
    setSellOpen(false);
    router.refresh();

    if (mode === "edit") {
      dismissToast();
      return;
    }

    const profit = computeProfit({
      soldPrice: sale.soldPrice,
      purchasePrice: item.purchasePrice,
      platformFees: sale.platformFees,
    });

    setUndoError(null);
    setToast({
      message: `Marked as sold · ${currencyFormatter.format(sale.soldPrice)} · profit ${currencyFormatter.format(profit ?? 0)}`,
    });
  }

  async function handleUndo(): Promise<void> {
    if (isUndoing) return;

    clearTimer();
    setUndoError(null);
    setIsUndoing(true);

    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_status",
          data: { status: "LISTED" },
        }),
      });

      if (!response.ok) {
        setUndoError(await responseError(response));
        return;
      }

      router.refresh();
      dismissToast();
    } catch {
      setUndoError(
        "Could not reach the item service. The sale was not undone; try again.",
      );
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <>
      <MarkSoldDialog
        item={isSellOpen ? item : null}
        mode={mode}
        onClose={() => setSellOpen(false)}
        onSold={handleSold}
      />

      {undoError && (
        <div
          role="alert"
          className="fixed bottom-24 left-1/2 z-[61] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border border-red-600/30 bg-background px-4 py-2 text-sm text-red-700 shadow-xl dark:border-red-400/30 dark:text-red-400"
        >
          <p className="min-w-0 flex-1">{undoError}</p>
          <button
            type="button"
            onClick={() => setUndoError(null)}
            className="min-h-11 shrink-0 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {toast && (
        <SaleToast
          message={toast.message}
          onUndo={() => void handleUndo()}
          onDismiss={dismissToast}
          isUndoing={isUndoing}
        />
      )}
    </>
  );
}

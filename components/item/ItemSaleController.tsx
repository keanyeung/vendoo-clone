"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import MarkSoldDialog from "@/components/MarkSoldDialog";
import { UndoToast } from "@/components/UndoToast";
import { useItemDetail } from "@/components/item/ItemDetailProvider";
import { computeProfit } from "@/lib/analytics";
import type { ItemDto } from "@/lib/item-dto";
import type { MarkSoldInput } from "@/lib/item-schema";

type ToastState = {
  message: string;
  tone?: "default" | "error";
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
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  const mode = item.status === "SOLD" ? "edit" : "create";

  function dismissToast(): void {
    setToast(null);
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

    setToast({
      message: `Marked as sold · ${currencyFormatter.format(sale.soldPrice)} · profit ${currencyFormatter.format(profit ?? 0)}`,
    });
  }

  async function handleUndo(): Promise<void> {
    if (isUndoing) return;

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
        setToast({
          message: await responseError(response),
          tone: "error",
        });
        return;
      }

      router.refresh();
      dismissToast();
    } catch {
      setToast({
        message:
          "Could not reach the item service. The sale was not undone; try again.",
        tone: "error",
      });
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

      {toast && (
        <UndoToast
          message={toast.message}
          onUndo={toast.tone === "error" ? undefined : () => void handleUndo()}
          onDismiss={dismissToast}
          isUndoing={isUndoing}
          tone={toast.tone}
        />
      )}
    </>
  );
}

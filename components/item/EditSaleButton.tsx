"use client";

import { useItemDetail } from "@/components/item/ItemDetailProvider";

export function EditSaleButton() {
  const { setSellOpen } = useItemDetail();

  return (
    <button
      type="button"
      onClick={() => setSellOpen(true)}
      className="mt-5 min-h-11 rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/[.04] dark:border-white/20 dark:hover:bg-white/[.06]"
    >
      Edit sale
    </button>
  );
}

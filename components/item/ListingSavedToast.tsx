"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { UndoToast } from "@/components/UndoToast";
import { carryListingContext } from "@/lib/listing-context";

export function ListingSavedToast({
  itemId,
  show,
  from = null,
}: {
  itemId: string;
  show: boolean;
  from?: string | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState<boolean>(show);
  const cleanHref = from
    ? carryListingContext(`/listings/${itemId}`, { from })
    : `/listings/${itemId}`;

  function dismiss(): void {
    setVisible(false);
    router.replace(cleanHref, { scroll: false });
  }

  if (!visible) return null;

  return <UndoToast message="Listing saved" onDismiss={dismiss} />;
}

import type { ItemDto } from "@/lib/item-dto";

export const STATUS_STYLES = {
  DRAFT: {
    label: "Draft",
    className:
      "bg-black/[.06] text-black/65 dark:bg-white/10 dark:text-white/70",
  },
  LISTED: {
    label: "Listed",
    className: "bg-foreground text-background",
  },
  SOLD: {
    label: "Sold",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
  },
} satisfies Record<
  ItemDto["status"],
  { label: string; className: string }
>;

export const DETAIL_STATUS_STYLES = {
  DRAFT: STATUS_STYLES.DRAFT,
  LISTED: {
    label: "Listed",
    className:
      "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300",
  },
  SOLD: STATUS_STYLES.SOLD,
} satisfies Record<
  ItemDto["status"],
  { label: string; className: string }
>;

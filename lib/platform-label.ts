import type { ItemDto } from "@/lib/item-dto";

// Shared so every surface that names a sale's marketplace spells it the same way.
export const PLATFORM_LABELS = {
  FB_MARKETPLACE: "Facebook Marketplace",
  DEPOP: "Depop",
  EBAY: "eBay",
} satisfies Record<NonNullable<ItemDto["soldPlatform"]>, string>;

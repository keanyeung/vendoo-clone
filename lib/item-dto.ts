import type { Item, ItemStatus, Platform } from "@prisma/client";

// Converts Prisma Item rows into plain, JSON-serializable objects safe to render and pass to Client Components.
export type ItemDto = {
  id: string;
  createdAt: string;
  updatedAt: string;
  photos: string[];
  title: string;
  summary: string | null;
  description: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  condition: string | null;
  conditionNotes: string | null;
  suggestedPrice: number | null;
  priceLow: number | null;
  priceHigh: number | null;
  priceReasoning: string | null;
  listPrice: number;
  purchasePrice: number;
  keywords: string[];
  aiConfidence: string | null;
  purchaseDate: string | null;
  notes: string | null;
  status: ItemStatus;
  soldPrice: number | null;
  soldPlatform: Platform | null;
  soldDate: string | null;
  platformFees: number | null;
};

export type ListingRowDto = {
  id: string;
  createdAt: string;
  photos: string[];
  title: string;
  status: ItemStatus;
  brand: string | null;
  size: string | null;
  category: string | null;
  listPrice: number;
  purchasePrice: number;
  soldPrice: number | null;
  soldPlatform: Platform | null;
  soldDate: string | null;
  platformFees: number | null;
};

type ListingRow = Pick<
  Item,
  | "id"
  | "createdAt"
  | "photos"
  | "title"
  | "status"
  | "brand"
  | "size"
  | "category"
  | "listPrice"
  | "purchasePrice"
  | "soldPrice"
  | "soldPlatform"
  | "soldDate"
  | "platformFees"
>;

export function toItemDto(item: Item): ItemDto {
  return {
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    photos: item.photos,
    title: item.title,
    summary: item.summary,
    description: item.description,
    brand: item.brand,
    category: item.category,
    size: item.size,
    color: item.color,
    condition: item.condition,
    conditionNotes: item.conditionNotes,
    suggestedPrice:
      item.suggestedPrice === null ? null : Number(item.suggestedPrice),
    priceLow: item.priceLow === null ? null : Number(item.priceLow),
    priceHigh: item.priceHigh === null ? null : Number(item.priceHigh),
    priceReasoning: item.priceReasoning,
    listPrice: Number(item.listPrice),
    purchasePrice: Number(item.purchasePrice),
    keywords: item.keywords,
    aiConfidence: item.aiConfidence,
    purchaseDate:
      item.purchaseDate === null ? null : item.purchaseDate.toISOString(),
    notes: item.notes,
    status: item.status,
    soldPrice: item.soldPrice === null ? null : Number(item.soldPrice),
    soldPlatform: item.soldPlatform,
    soldDate: item.soldDate === null ? null : item.soldDate.toISOString(),
    platformFees:
      item.platformFees === null ? null : Number(item.platformFees),
  };
}

export function toItemDtos(items: Item[]): ItemDto[] {
  return items.map(toItemDto);
}

export function toListingRowDto(item: ListingRow): ListingRowDto {
  return {
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    photos: item.photos,
    title: item.title,
    status: item.status,
    brand: item.brand,
    size: item.size,
    category: item.category,
    listPrice: Number(item.listPrice),
    purchasePrice: Number(item.purchasePrice),
    soldPrice: item.soldPrice === null ? null : Number(item.soldPrice),
    soldPlatform: item.soldPlatform,
    soldDate: item.soldDate === null ? null : item.soldDate.toISOString(),
    platformFees:
      item.platformFees === null ? null : Number(item.platformFees),
  };
}

export function toListingRowDtos(items: ListingRow[]): ListingRowDto[] {
  return items.map(toListingRowDto);
}

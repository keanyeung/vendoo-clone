import type { ItemDto } from "@/lib/item-dto";

// Sorting stays in memory because the page already fetches every row, and computed columns such as days listed (and later profit) cannot be expressed with Prisma orderBy.
export type SortDir = "asc" | "desc";
export type SortField =
  | "added"
  | "price"
  | "sold"
  | "soldDate"
  | "days"
  | "status"
  | "title";
export type SortToken = { field: SortField; dir: SortDir };

export const DEFAULT_SORT: SortToken = { field: "added", dir: "desc" };

const sortFields = new Set<SortField>([
  "added",
  "price",
  "sold",
  "soldDate",
  "days",
  "status",
  "title",
]);
const sortDirs = new Set<SortDir>(["asc", "desc"]);
const legacySorts: Record<string, SortToken> = {
  newest: { field: "added", dir: "desc" },
  oldest: { field: "added", dir: "asc" },
  "price-high": { field: "price", dir: "desc" },
  "price-low": { field: "price", dir: "asc" },
};

function isSortField(value: string): value is SortField {
  return sortFields.has(value as SortField);
}

function isSortDir(value: string): value is SortDir {
  return sortDirs.has(value as SortDir);
}

export function parseSort(raw: string | null | undefined): SortToken {
  if (!raw) return DEFAULT_SORT;

  const legacySort = legacySorts[raw];
  if (legacySort) return legacySort;

  const separatorIndex = raw.lastIndexOf("-");
  const field = raw.slice(0, separatorIndex);
  const dir = raw.slice(separatorIndex + 1);

  if (!isSortField(field) || !isSortDir(dir)) return DEFAULT_SORT;
  return { field, dir };
}

export function serializeSort(token: SortToken): string {
  return `${token.field}-${token.dir}`;
}

// Whole days an item has been listed: from createdAt to soldDate (if sold) or now.
export function daysListed(item: ItemDto, now: number = Date.now()): number {
  const endMs = item.soldDate ? Date.parse(item.soldDate) : now;
  return Math.max(
    0,
    Math.floor((endMs - Date.parse(item.createdAt)) / 86_400_000),
  );
}

export function sortItems(
  items: ItemDto[],
  token: SortToken,
  now: number = Date.now(),
): ItemDto[] {
  const statusRanks: Record<ItemDto["status"], number> = {
    DRAFT: 0,
    LISTED: 1,
    SOLD: 2,
  };
  const ascendingComparators: Record<
    SortField,
    (a: ItemDto, b: ItemDto) => number
  > = {
    added: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    price: (a, b) => a.listPrice - b.listPrice,
    sold: (a, b) => (a.soldPrice ?? 0) - (b.soldPrice ?? 0),
    soldDate: (a, b) =>
      Date.parse(a.soldDate ?? "") - Date.parse(b.soldDate ?? ""),
    days: (a, b) => daysListed(a, now) - daysListed(b, now),
    status: (a, b) => statusRanks[a.status] - statusRanks[b.status],
    title: (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  };

  return [...items].sort((a, b) => {
    if (token.field === "sold" || token.field === "soldDate") {
      const aValue = token.field === "sold" ? a.soldPrice : a.soldDate;
      const bValue = token.field === "sold" ? b.soldPrice : b.soldDate;
      if (aValue === null && bValue !== null) return 1;
      if (aValue !== null && bValue === null) return -1;
    }

    const baseResult = ascendingComparators[token.field](a, b);
    const directedResult = token.dir === "asc" ? baseResult : -baseResult;
    return directedResult || a.id.localeCompare(b.id);
  });
}

import type { Sale } from "./analytics";

export type SoldItemsSortField =
  | "title"
  | "soldAt"
  | "soldPrice"
  | "profit"
  | "roi";
export type SortDirection = "asc" | "desc";
export type SoldItemsSort = {
  field: SoldItemsSortField;
  dir: SortDirection;
};

export const DEFAULT_SOLD_ITEMS_SORT: SoldItemsSort = {
  field: "soldAt",
  dir: "desc",
};

export function sortSoldItems(
  sales: Sale[],
  sort: SoldItemsSort,
): Sale[] {
  const ascendingComparators: Record<
    SoldItemsSortField,
    (a: Sale, b: Sale) => number
  > = {
    title: (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
    soldAt: (a, b) => Date.parse(a.soldAt) - Date.parse(b.soldAt),
    soldPrice: (a, b) => a.soldPrice - b.soldPrice,
    profit: (a, b) => a.profit - b.profit,
    roi: (a, b) =>
      (a.roiPct ?? Number.NEGATIVE_INFINITY) -
      (b.roiPct ?? Number.NEGATIVE_INFINITY),
  };

  return [...sales].sort((a, b) => {
    const baseResult = ascendingComparators[sort.field](a, b);
    const directedResult = sort.dir === "asc" ? baseResult : -baseResult;
    return directedResult || a.id.localeCompare(b.id);
  });
}

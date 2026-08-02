import type { ItemStatus, Prisma } from "@prisma/client";

import {
  isAttentionFilterKey,
  type AttentionFilterKey,
} from "./listing-filters";
import { parsePage } from "./listing-page";
import {
  DEFAULT_SORT,
  parseSort,
  serializeSort,
  type SortToken,
} from "./listing-sort";

type SearchParamValue = string | string[] | undefined;
type SearchParamRecord = Record<string, SearchParamValue>;
type SearchParamReader = Pick<URLSearchParams, "get">;

export type ListingContext = {
  status: ItemStatus | "";
  q: string;
  attention: AttentionFilterKey | "";
  sort: string;
  view: "grid" | "table";
  page: number;
};

export type ListingContextInput =
  | ListingContext
  | SearchParamRecord
  | SearchParamReader;

export type ListingQuery = ListingContext & {
  sortToken: SortToken;
  where: Prisma.ItemWhereInput;
};

const DEFAULT_SORT_VALUE = serializeSort(DEFAULT_SORT);

function readParam(source: ListingContextInput, key: string): string {
  if ("get" in source && typeof source.get === "function") {
    return source.get(key) ?? "";
  }

  const value = (source as Record<string, SearchParamValue | number>)[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value === undefined ? "" : String(value);
}

function isItemStatus(value: string): value is ItemStatus {
  return value === "DRAFT" || value === "LISTED" || value === "SOLD";
}

function parseDirectContext(source: ListingContextInput): ListingContext {
  const rawStatus = readParam(source, "status");
  const rawAttention = readParam(source, "attention");
  const rawSort = readParam(source, "sort");

  return {
    status: isItemStatus(rawStatus) ? rawStatus : "",
    q: readParam(source, "q").trim(),
    attention: isAttentionFilterKey(rawAttention) ? rawAttention : "",
    sort: serializeSort(parseSort(rawSort)),
    view: readParam(source, "view") === "table" ? "table" : "grid",
    page: parsePage(readParam(source, "page")),
  };
}

// Accepts either a listings query or a detail/edit query carrying that query in
// one `from` parameter. Unknown parameters never become part of the context.
export function parseListingContext(
  searchParams: ListingContextInput,
): ListingContext {
  const from = readParam(searchParams, "from");
  return parseDirectContext(from ? new URLSearchParams(from) : searchParams);
}

export function buildListingsHref(params: ListingContextInput): string {
  const context = parseListingContext(params);
  const query = new URLSearchParams();

  if (context.status) query.set("status", context.status);
  if (context.q) query.set("q", context.q);
  if (context.attention) query.set("attention", context.attention);
  if (context.sort !== DEFAULT_SORT_VALUE) query.set("sort", context.sort);
  if (context.view === "table") query.set("view", context.view);
  if (context.page > 1) query.set("page", String(context.page));

  const serialized = query.toString();
  return serialized ? `/listings?${serialized}` : "/listings";
}

export function carryListingContext(
  href: string,
  params: ListingContextInput,
): string {
  const listingsHref = buildListingsHref(params);
  const separatorIndex = listingsHref.indexOf("?");
  if (separatorIndex === -1) return href;

  const from = listingsHref.slice(separatorIndex + 1);
  const [pathAndQuery, hash = ""] = href.split("#", 2);
  const separator = pathAndQuery.includes("?") ? "&" : "?";
  const carriedHref = `${pathAndQuery}${separator}${new URLSearchParams({ from }).toString()}`;
  return hash ? `${carriedHref}#${hash}` : carriedHref;
}

// This is the single source of truth for the Prisma filter and in-memory sort
// token used by both the listings page and contextual item navigation.
export function buildListingQuery(
  params: ListingContextInput,
): ListingQuery {
  const context = parseListingContext(params);
  const where: Prisma.ItemWhereInput = {};

  if (context.status) where.status = context.status;
  if (context.q) {
    where.OR = [
      { title: { contains: context.q, mode: "insensitive" } },
      { brand: { contains: context.q, mode: "insensitive" } },
      { category: { contains: context.q, mode: "insensitive" } },
    ];
  }

  return {
    ...context,
    sortToken: parseSort(context.sort),
    where,
  };
}

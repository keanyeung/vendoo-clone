"use client";

import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ATTENTION_FILTERS,
  type AttentionFilterKey,
} from "@/lib/listing-filters";
import {
  DEFAULT_SORT,
  parseSort,
  serializeSort,
  SORT_OPTIONS,
} from "@/lib/listing-sort";

type StatusValue = "" | "DRAFT" | "LISTED" | "SOLD";

const STATUS_OPTIONS: Array<{ value: StatusValue; label: string }> = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "LISTED", label: "Listed" },
  { value: "SOLD", label: "Sold" },
];

export type ListingsFilterBarProps = {
  status: string;
  q: string;
  attention: AttentionFilterKey | "";
  sort: string;
  view: "grid" | "table";
  statusCounts: Record<Exclude<StatusValue, "">, number>;
};

export default function ListingsFilterBar({
  status,
  q,
  attention,
  sort,
  view,
  statusCounts,
}: ListingsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawSort = searchParams.get("sort");
  const normalizedSort = serializeSort(parseSort(rawSort));
  const defaultSort = serializeSort(DEFAULT_SORT);
  const [searchText, setSearchText] = useState(q);
  const [isPending, startTransition] = useTransition();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The q value this component last navigated to, so the effect below can tell
  // an echo of our own navigation apart from an externally driven change.
  const navigatedQRef = useRef<string>(q);

  useEffect((): void => {
    // Adopt q only when it changed outside this component (browser back/forward,
    // or the "Clear filters" link in the empty state). Syncing unconditionally
    // would let the echo of our own debounced navigation overwrite characters
    // typed while that request was still in flight.
    if (q !== navigatedQRef.current) {
      navigatedQRef.current = q;
      setSearchText(q);
    }
  }, [q]);

  useEffect(() => {
    return (): void => {
      clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  function navigate(
    nextStatus: string,
    nextQ: string,
    nextSort: string | null,
    nextAttention: AttentionFilterKey | "",
  ): void {
    const params = new URLSearchParams();
    const trimmedQ = nextQ.trim();
    const nextNormalizedSort = serializeSort(parseSort(nextSort));

    if (nextStatus) params.set("status", nextStatus);
    if (trimmedQ) params.set("q", trimmedQ);
    if (nextAttention) params.set("attention", nextAttention);
    if (nextNormalizedSort !== defaultSort) {
      params.set("sort", nextNormalizedSort);
    }
    if (view === "table") params.set("view", "table");

    navigatedQRef.current = trimmedQ;

    const queryString = params.toString();
    startTransition((): void => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    });
  }

  function handleStatusChange(nextStatus: StatusValue): void {
    clearTimeout(searchTimeoutRef.current);
    navigate(nextStatus, searchText, rawSort, attention);
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextSearchText = event.target.value;
    setSearchText(nextSearchText);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout((): void => {
      navigate(status, nextSearchText, rawSort, attention);
    }, 300);
  }

  function handleSortChange(event: ChangeEvent<HTMLSelectElement>): void {
    clearTimeout(searchTimeoutRef.current);
    navigate(status, searchText, event.target.value, attention);
  }

  function handleAttentionChange(nextAttention: AttentionFilterKey): void {
    clearTimeout(searchTimeoutRef.current);
    navigate(
      status,
      searchText,
      rawSort,
      attention === nextAttention ? "" : nextAttention,
    );
  }

  function clearSearch(): void {
    clearTimeout(searchTimeoutRef.current);
    setSearchText("");
    navigate(status, "", rawSort, attention);
  }

  function clearFilters(): void {
    clearTimeout(searchTimeoutRef.current);
    setSearchText("");
    navigatedQRef.current = "";
    startTransition((): void => {
      router.replace(view === "table" ? `${pathname}?view=table` : pathname);
    });
  }

  const hasActiveFilters =
    status !== "" ||
    q.trim() !== "" ||
    attention !== "" ||
    sort !== defaultSort;
  const controlClassName =
    "min-h-11 rounded-md border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-black/40 dark:border-white/20 dark:bg-black dark:text-white dark:focus:border-white/50";
  const allCount =
    statusCounts.DRAFT + statusCounts.LISTED + statusCounts.SOLD;
  const chipBaseClassName =
    "inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const activeChipClassName =
    "border-foreground bg-foreground text-background";
  const inactiveChipClassName =
    "border-black/15 bg-background text-black/65 hover:bg-black/[.04] hover:text-black dark:border-white/20 dark:text-white/65 dark:hover:bg-white/[.06] dark:hover:text-white";

  return (
    <div
      aria-busy={isPending}
      className="mt-6 flex min-w-0 flex-col gap-4 rounded-xl border border-black/15 p-4 dark:border-white/20"
    >
      <fieldset className="min-w-0">
        <legend className="mb-1 text-sm font-medium">Status</legend>
        <div className="-mx-2 overflow-x-auto px-2 py-1 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {STATUS_OPTIONS.map((option) => {
              const count =
                option.value === "" ? allCount : statusCounts[option.value];
              const isActive = status === option.value;

              return (
                <button
                  key={option.value || "all"}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleStatusChange(option.value)}
                  className={`${chipBaseClassName} ${
                    isActive ? activeChipClassName : inactiveChipClassName
                  }`}
                >
                  {option.label}
                  <span className="ml-1.5 tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="mb-1 text-sm font-medium">Attention</legend>
        <div className="-mx-2 overflow-x-auto px-2 py-1 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {ATTENTION_FILTERS.map((filter) => {
              const isActive = attention === filter.key;

              return (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleAttentionChange(filter.key)}
                  className={`${chipBaseClassName} ${
                    isActive ? activeChipClassName : inactiveChipClassName
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
          <span className="flex items-center justify-between gap-2">
            <label htmlFor="listings-search">Search</label>
            <span
              aria-live="polite"
              aria-atomic="true"
              className="h-4 text-xs font-normal text-black/60 dark:text-white/60"
            >
              {isPending ? (
                <span className="motion-safe:animate-pulse">Updating…</span>
              ) : null}
            </span>
          </span>
          <span className="relative">
            <input
              id="listings-search"
              type="search"
              value={searchText}
              onChange={handleSearchChange}
              placeholder="Search title, brand, category…"
              className={`${controlClassName} w-full pr-12`}
            />
            {searchText !== "" && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 inline-flex min-h-11 w-11 items-center justify-center rounded-r-md text-lg text-black/50 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground dark:text-white/50 dark:hover:text-white"
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </span>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Sort
          <select
            value={normalizedSort}
            onChange={handleSortChange}
            className={controlClassName}
          >
            {SORT_OPTIONS.map((option) => (
              <option
                key={serializeSort(option.token)}
                value={serializeSort(option.token)}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-md border border-black/15 px-3 py-2.5 text-sm font-medium text-black/60 hover:text-black dark:border-white/20 dark:text-white/60 dark:hover:text-white"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

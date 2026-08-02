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
  DEFAULT_SORT,
  parseSort,
  serializeSort,
  SORT_OPTIONS,
} from "@/lib/listing-sort";

export type ListingsFilterBarProps = {
  status: string;
  q: string;
  sort: string;
  view: "grid" | "table";
};

export default function ListingsFilterBar({
  status,
  q,
  sort,
  view,
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
  ): void {
    const params = new URLSearchParams();
    const trimmedQ = nextQ.trim();
    const nextNormalizedSort = serializeSort(parseSort(nextSort));

    if (nextStatus) params.set("status", nextStatus);
    if (trimmedQ) params.set("q", trimmedQ);
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

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>): void {
    clearTimeout(searchTimeoutRef.current);
    navigate(event.target.value, searchText, rawSort);
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextSearchText = event.target.value;
    setSearchText(nextSearchText);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout((): void => {
      navigate(status, nextSearchText, rawSort);
    }, 300);
  }

  function handleSortChange(event: ChangeEvent<HTMLSelectElement>): void {
    clearTimeout(searchTimeoutRef.current);
    navigate(status, searchText, event.target.value);
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
    status !== "" || q.trim() !== "" || sort !== defaultSort;
  const controlClassName =
    "rounded-md border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-black/40 dark:border-white/20 dark:bg-black dark:text-white dark:focus:border-white/50";

  return (
    <div
      aria-busy={isPending}
      className="mt-6 flex flex-col gap-4 rounded-xl border border-black/15 p-4 dark:border-white/20 sm:flex-row sm:items-end"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        Status
        <select
          value={status}
          onChange={handleStatusChange}
          className={controlClassName}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="LISTED">Listed</option>
          <option value="SOLD">Sold</option>
        </select>
      </label>

      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium">
        <span className="flex items-center justify-between gap-2">
          Search
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
        <input
          type="search"
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search title, brand, category…"
          className={controlClassName}
        />
      </label>

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
  );
}

"use client";

import {
  type ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const rawSort = searchParams.get("sort") ?? "";
  const [searchText, setSearchText] = useState(q);
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

  function navigate(nextStatus: string, nextQ: string, nextSort: string): void {
    const params = new URLSearchParams();
    const trimmedQ = nextQ.trim();

    if (nextStatus) params.set("status", nextStatus);
    if (trimmedQ) params.set("q", trimmedQ);
    if (nextSort && nextSort !== "newest") params.set("sort", nextSort);
    if (view === "table") params.set("view", "table");

    navigatedQRef.current = trimmedQ;

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
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
    router.replace(view === "table" ? `${pathname}?view=table` : pathname);
  }

  const hasActiveFilters =
    status !== "" || q.trim() !== "" || sort !== "newest";
  const selectValue = [
    "newest",
    "oldest",
    "price-high",
    "price-low",
  ].includes(sort)
    ? sort
    : "newest";
  const controlClassName =
    "rounded-md border border-black/15 bg-white px-3 py-2 text-base text-black outline-none focus:border-black/40 dark:border-white/20 dark:bg-black dark:text-white dark:focus:border-white/50";

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-xl border border-black/15 p-4 dark:border-white/20 sm:flex-row sm:items-end">
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
        Search
        <input
          type="search"
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Search title, brand, category…"
          className={controlClassName}
        />
      </label>

      {view === "grid" && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Sort
          <select
            value={selectValue}
            onChange={handleSortChange}
            className={controlClassName}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="price-high">Price: high to low</option>
            <option value="price-low">Price: low to high</option>
          </select>
        </label>
      )}

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

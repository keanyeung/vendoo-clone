"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ListingsSelectionContextValue = {
  selectedIds: ReadonlySet<string>;
  selectedCount: number;
  toggle: (id: string) => void;
  selectRange: (
    pageIds: string[],
    fromId: string,
    toId: string,
    selected: boolean,
  ) => void;
  selectAll: (pageIds: string[]) => void;
  clear: () => void;
};

const ListingsSelectionContext =
  createContext<ListingsSelectionContextValue | null>(null);

export default function ListingsSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const value = useMemo<ListingsSelectionContextValue>(
    () => ({
      selectedIds,
      selectedCount: selectedIds.size,
      toggle(id) {
        setSelectedIds((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      },
      selectRange(pageIds, fromId, toId, selected) {
        setSelectedIds((current) => {
          const fromIndex = pageIds.indexOf(fromId);
          const toIndex = pageIds.indexOf(toId);
          if (fromIndex === -1 || toIndex === -1) return current;

          const next = new Set(current);
          const start = Math.min(fromIndex, toIndex);
          const end = Math.max(fromIndex, toIndex);
          for (const id of pageIds.slice(start, end + 1)) {
            if (selected) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      },
      selectAll(pageIds) {
        setSelectedIds((current) => {
          const next = new Set(current);
          const allOnPageSelected =
            pageIds.length > 0 && pageIds.every((id) => next.has(id));

          for (const id of pageIds) {
            if (allOnPageSelected) next.delete(id);
            else next.add(id);
          }
          return next;
        });
      },
      clear() {
        setSelectedIds((current) =>
          current.size === 0 ? current : new Set(),
        );
      },
    }),
    [selectedIds],
  );

  return (
    <ListingsSelectionContext.Provider value={value}>
      {children}
    </ListingsSelectionContext.Provider>
  );
}

export function useListingsSelection(): ListingsSelectionContextValue {
  const context = useContext(ListingsSelectionContext);
  if (context === null) {
    throw new Error(
      "useListingsSelection must be used inside ListingsSelectionProvider.",
    );
  }
  return context;
}

export function ListingSelectionCheckbox({
  id,
  title,
  className = "",
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const { selectedIds, toggle } = useListingsSelection();

  return (
    <label
      className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg bg-background/90 shadow-sm backdrop-blur-sm ${className}`}
    >
      <input
        type="checkbox"
        checked={selectedIds.has(id)}
        onChange={() => toggle(id)}
        aria-label={`Select ${title}`}
        className="size-5 cursor-pointer accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      />
    </label>
  );
}

"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";

type ItemDetailContextValue = {
  isEditOpen: boolean;
  setEditOpen: Dispatch<SetStateAction<boolean>>;
  isSellOpen: boolean;
  setSellOpen: Dispatch<SetStateAction<boolean>>;
};

const ItemDetailContext = createContext<ItemDetailContextValue | null>(null);

export function ItemDetailProvider({ children }: { children: ReactNode }) {
  const [isEditOpen, setEditOpen] = useState<boolean>(false);
  const [isSellOpen, setSellOpen] = useState<boolean>(false);

  return (
    <ItemDetailContext.Provider
      value={{ isEditOpen, setEditOpen, isSellOpen, setSellOpen }}
    >
      {children}
    </ItemDetailContext.Provider>
  );
}

export function useItemDetail(): ItemDetailContextValue {
  const context = useContext(ItemDetailContext);

  if (context === null) {
    throw new Error("useItemDetail must be used within an ItemDetailProvider.");
  }

  return context;
}

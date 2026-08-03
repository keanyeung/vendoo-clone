"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";
import type { ItemDto } from "@/lib/item-dto";

type ItemDetailContextValue = {
  item: ItemDto;
  setItem: Dispatch<SetStateAction<ItemDto>>;
  isEditOpen: boolean;
  setEditOpen: Dispatch<SetStateAction<boolean>>;
  isSellOpen: boolean;
  setSellOpen: Dispatch<SetStateAction<boolean>>;
};

const ItemDetailContext = createContext<ItemDetailContextValue | null>(null);

export function ItemDetailProvider({
  initialItem,
  children,
}: {
  initialItem: ItemDto;
  children: ReactNode;
}) {
  const [item, setItem] = useState<ItemDto>(initialItem);
  const [isEditOpen, setEditOpen] = useState<boolean>(false);
  const [isSellOpen, setSellOpen] = useState<boolean>(false);

  return (
    <ItemDetailContext.Provider
      value={{
        item,
        setItem,
        isEditOpen,
        setEditOpen,
        isSellOpen,
        setSellOpen,
      }}
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

import { create } from "zustand";

interface BillsState {
  dueSoonCount: number;
  setDueSoonCount: (count: number) => void;
}

export const useBillsStore = create<BillsState>((set) => ({
  dueSoonCount: 0,
  setDueSoonCount: (count) => set({ dueSoonCount: count }),
}));

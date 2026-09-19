'use client';

import { create } from 'zustand';

interface CommandState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  openedAt: number;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  open: false,
  openedAt: 0,
  setOpen: (open) => set({ open, openedAt: open ? Date.now() : 0 }),
  toggle: () => get().setOpen(!get().open),
}));

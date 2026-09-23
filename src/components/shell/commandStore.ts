'use client';

import { create } from 'zustand';

interface CommandState {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Opens the palette already searching for `seed`. */
  openWith: (seed: string) => void;
  toggle: () => void;
  openedAt: number;
  seed: string;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  open: false,
  openedAt: 0,
  seed: '',
  setOpen: (open) => set({ open, openedAt: open ? Date.now() : 0, seed: '' }),
  openWith: (seed) => set({ open: true, openedAt: Date.now(), seed: seed.slice(0, 120) }),
  toggle: () => get().setOpen(!get().open),
}));

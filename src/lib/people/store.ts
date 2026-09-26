'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TravelCard } from './card';

export type SavedPerson = { id: string; card: TravelCard; savedAt: string };

const MAX_PEOPLE = 60;
const personKey = (card: TravelCard) => `${card.name.toLowerCase()}|${(card.hometown ?? '').toLowerCase()}`;

interface PeopleState {
  people: SavedPerson[];
  /** Saves a card, or refreshes the one already saved for the same name and home city. */
  savePerson: (card: TravelCard) => string;
  removePerson: (id: string) => void;
}

/** The people someone travels with, from the cards they were sent. On this device only. */
export const usePeopleStore = create<PeopleState>()(
  persist(
    (set, get) => ({
      people: [],
      savePerson: (card) => {
        const existing = get().people.find((person) => personKey(person.card) === personKey(card));
        const id = existing?.id ?? `pp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const person: SavedPerson = { id, card, savedAt: new Date().toISOString() };
        set((state) => ({ people: [person, ...state.people.filter((entry) => entry.id !== id)].slice(0, MAX_PEOPLE) }));
        return id;
      },
      removePerson: (id) => set((state) => ({ people: state.people.filter((entry) => entry.id !== id) })),
    }),
    { name: 'dope.people.v1', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

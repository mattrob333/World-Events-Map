'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { track } from '@/lib/analytics';
import type { IntentRecord, IntentTargetKind, IntentVerb } from './types';

interface IntentState {
  items: IntentRecord[];
  toggle: (input: Omit<IntentRecord, 'createdAt'> & { verb: IntentVerb }) => void;
  has: (verb: IntentVerb, kind: IntentTargetKind, id: string) => boolean;
  list: (verb?: IntentVerb) => IntentRecord[];
}

function keyOf(verb: IntentVerb, kind: IntentTargetKind, id: string): string {
  return `${verb}:${kind}:${id}`;
}

export const useIntentStore = create<IntentState>()(
  persist(
    (set, get) => ({
      items: [],
      has: (verb, kind, id) =>
        get().items.some((item) => item.verb === verb && item.kind === kind && item.id === id),
      list: (verb) =>
        verb ? get().items.filter((item) => item.verb === verb) : get().items,
      toggle: (input) => {
        const exists = get().has(input.verb, input.kind, input.id);
        set((state) => ({
          items: exists
            ? state.items.filter(
                (item) => keyOf(item.verb, item.kind, item.id) !== keyOf(input.verb, input.kind, input.id),
              )
            : [
                ...state.items,
                { ...input, createdAt: new Date().toISOString() },
              ],
        }));
        if (!exists) {
          if (input.kind === 'destination' && input.verb === 'save') {
            track('destination_saved', { id: input.id });
          } else if (input.kind === 'destination' && input.verb === 'watch') {
            track('destination_watched', { id: input.id });
          } else if (input.kind === 'destination' && input.verb === 'idGo') {
            track('destination_id_go', { id: input.id });
          } else if (input.kind === 'event' && input.verb === 'save') {
            track('event_saved', { id: input.id });
          } else if (input.kind === 'inspiration' && input.verb === 'save') {
            track('inspiration_added', { id: input.id });
          } else if (input.kind === 'offer') {
            track('access_offer_opened', { id: input.id });
          }
        }
      },
    }),
    {
      name: 'meridian.intent.v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

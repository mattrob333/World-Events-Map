/** Per-slot, per-card votes: participant id → +1 (love) or -1 (pass). */
export type CardVotes = Record<string, 1 | -1>;
export type SlotVotes = Record<string, CardVotes>;
export type TripVotes = Record<string, SlotVotes>;

export type SortMode = 'curated' | 'group';
export type SlotFilter = 'all' | 'loved' | 'unvoted' | 'mine';

export function tally(votes: CardVotes | undefined): { up: number; down: number; score: number } {
  let up = 0;
  let down = 0;
  for (const value of Object.values(votes ?? {})) {
    if (value > 0) up += 1;
    else down += 1;
  }
  return { up, down, score: up - down };
}

/** Group sort is stable: ties keep the curated order. */
export function orderSlot(cardIds: string[], votes: SlotVotes | undefined, mode: SortMode): string[] {
  if (mode === 'curated') return cardIds;
  return cardIds
    .map((id, index) => ({ id, index, score: tally(votes?.[id]).score }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.id);
}

export function filterSlot(cardIds: string[], votes: SlotVotes | undefined, filter: SlotFilter, participantId?: string): string[] {
  if (filter === 'all') return cardIds;
  return cardIds.filter((id) => {
    const cardVotes = votes?.[id] ?? {};
    if (filter === 'loved') return tally(cardVotes).up > 0;
    if (filter === 'unvoted') return participantId ? cardVotes[participantId] === undefined : Object.keys(cardVotes).length === 0;
    return participantId ? cardVotes[participantId] === 1 : false;
  });
}

/** Moves a card between (or within) slots. Returns new arrays; never mutates. */
export function moveCard(
  slots: Record<string, string[]>,
  cardId: string,
  from: string,
  to: string,
  toIndex = 0,
): Record<string, string[]> {
  if (!slots[from]?.includes(cardId) || !slots[to]) return slots;
  const next = { ...slots, [from]: slots[from].filter((id) => id !== cardId) };
  const target = next[to].filter((id) => id !== cardId);
  const index = Math.max(0, Math.min(toIndex, target.length));
  target.splice(index, 0, cardId);
  next[to] = target;
  return next;
}

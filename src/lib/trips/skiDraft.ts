/**
 * Family-ski drafts hold household details (children's ages, origin, budget),
 * so they live in this tab only and are cleared on sign-out from any page,
 * after a Circle is created, and when a signed-in member arrives
 * (red team release review, shared-device leak).
 */
export const SKI_DRAFT_PREFIX = 'meridian.ski-draft.v1:';

type DraftStorage = Pick<Storage, 'length' | 'key' | 'removeItem'>;

function sessionStore(): DraftStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function skiDraftKey(ownerId: string | null | undefined): string {
  return `${SKI_DRAFT_PREFIX}${ownerId ?? 'visitor'}`;
}

export function clearSkiDrafts(storage: DraftStorage | null = sessionStore()): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(SKI_DRAFT_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export const INTENT_VERBS = ['save', 'watch', 'idGo'] as const;
export type IntentVerb = (typeof INTENT_VERBS)[number];

export const INTENT_TARGETS = ['destination', 'event', 'inspiration', 'offer'] as const;
export type IntentTargetKind = (typeof INTENT_TARGETS)[number];

export interface IntentRecord {
  verb: IntentVerb;
  kind: IntentTargetKind;
  id: string;
  label: string;
  href: string;
  createdAt: string;
}

export const INTENT_LABEL: Record<IntentVerb, string> = {
  save: 'Save',
  watch: 'Watch',
  idGo: "I'd go",
};

export const INTENT_HINT: Record<IntentVerb, string> = {
  save: 'Remember this on this device.',
  watch: 'Flag it so you can return when the picture changes. No push notifications yet.',
  idGo: 'Stronger intent. Matching against other travelers is not live yet.',
};

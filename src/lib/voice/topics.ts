/**
 * What the Vibe stage asks about, as bullets on screen. The voice concierge
 * locks a fact against a topic (lock_fact) and the bullet lights up with it,
 * so the screen is the agenda and the voice only fills gaps. Plain data:
 * shared by the session route (the tool's enum) and the browser.
 */

export type TopicMode = 'profile' | 'trip' | 'now';
export type Topic = { key: string; label: string; hint: string; core?: boolean };

/** The profile is the long view: a wide lens on who they are, a little back-and-forth allowed. */
export const PROFILE_TOPICS: readonly Topic[] = [
  { key: 'home', label: 'Home base', hint: 'Where you live, where you grew up', core: true },
  { key: 'crew', label: 'Your crew', hint: 'Solo, partner, friends, kids’ ages', core: true },
  { key: 'music', label: 'On repeat', hint: 'Artists you’d fly to see', core: true },
  { key: 'food', label: 'How you eat and drink', hint: 'Tasting menus, taco trucks, wine', core: true },
  { key: 'teams', label: 'Who you root for', hint: 'Teams, sports, events you’d travel for' },
  { key: 'pace', label: 'Your pace', hint: 'Up early or out late, slow or packed' },
  { key: 'splurge', label: 'Splurge and save', hint: 'Where the money goes, where it doesn’t' },
  { key: 'avoid', label: 'Hard no’s', hint: 'What ruins a trip for you' },
  { key: 'best', label: 'Best trip ever', hint: 'The one you still talk about, and what made it' },
];

/** A trip is quick fact-gathering: five things, then build. */
export const TRIP_TOPICS: readonly Topic[] = [
  { key: 'where', label: 'Where', hint: 'A place, a region, or just the feeling', core: true },
  { key: 'when', label: 'When', hint: 'Dates or a month, and how long', core: true },
  { key: 'who', label: 'Who’s coming', hint: 'You, the crew, kids and their ages', core: true },
  { key: 'vibe', label: 'The vibe', hint: 'Nights out, food, snow, beach, culture' },
  { key: 'must', label: 'Must-do or skip', hint: 'A show, a match, a table, or a hard no' },
];

/** Right now, right here: where they are and what they're after, then go. */
export const NOW_TOPICS: readonly Topic[] = [
  { key: 'here', label: 'Where you are', hint: 'Your location, or a neighborhood like Flushing, Queens', core: true },
  { key: 'after', label: 'What you’re after', hint: 'A bar, a late bite, live music, something to do', core: true },
  { key: 'energy', label: 'The energy', hint: 'Low-key, social, or packed and loud' },
  { key: 'late', label: 'How late', hint: 'Somewhere that stays open late' },
];

export function topicsFor(mode: TopicMode): readonly Topic[] {
  return mode === 'profile' ? PROFILE_TOPICS : mode === 'now' ? NOW_TOPICS : TRIP_TOPICS;
}

export const TOPIC_KEYS = [...new Set([...PROFILE_TOPICS, ...TRIP_TOPICS, ...NOW_TOPICS].map((topic) => topic.key))];

/** The bullets as one line for the model: "home (Home base: Where you live…); …". */
export function topicAgenda(mode: TopicMode): string {
  return topicsFor(mode).map((topic) => `${topic.key} (${topic.label}: ${topic.hint})`).join('; ');
}

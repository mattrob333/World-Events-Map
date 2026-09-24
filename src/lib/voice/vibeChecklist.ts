import { parseProfileLocally } from '@/lib/designer/profile';
import { placeFromTypedTrip } from './vibe';

export type VibeMode = 'profile' | 'trip';

export interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  done: boolean;
}

const CREW = /\b(solo|alone|by myself|friends|the crew|my crew|wife|husband|partner|girlfriend|boyfriend|kids?|son|daughter|family|mom|dad|brother|sister)\b/i;
const FOOD = /\b(omakase|tasting menus?|tacos?|taco trucks?|bbq|barbecue|sushi|ramen|pizza|steak|seafood|vegan|vegetarian|street food|foodie|restaurants?|brunch|wine|cocktails?|coffee|michelin|dive bars?|eat|eating|food)\b/i;
const MUSIC = /\b(music|concerts?|festivals?|live shows?|band|bands|rapper|dj|playlist|on repeat|listen(?:ing)? to|hip.?hop|jazz|house|techno|country|rock|r&b|edm)\b/i;
const WHEN = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|spring|summer|fall|autumn|winter|weekend|next week|next month|this week|tomorrow|tonight|\d+\s*(?:nights?|days?|weeks?)|\d{1,2}(?:st|nd|rd|th))\b/i;
const WHO = /\b(me and|with (?:my|the|a)|solo|alone|by myself|just me|we're|we are|us|the crew|family|friends|wife|husband|partner|kids?)\b/i;
const MUST = /\b(must|have to|need to|gotta|got to|want to see|non-?negotiable|definitely|can't miss|bucket list)\b/i;
const NOT = /\b(no|not|don't|do not|avoid|skip|without|hate)\b/i;

/** What to talk about for a profile, ticked as the local parser picks each part up. */
export function profileChecklist(text: string): ChecklistItem[] {
  const p = text.trim().length >= 3 ? parseProfileLocally(text) : null;
  return [
    { key: 'home', label: 'Home', hint: 'Where you live, where you grew up', done: Boolean(p?.hometown) },
    { key: 'teams', label: 'Who you root for', hint: 'Your teams, your sports', done: Boolean(p?.teams.length) },
    { key: 'music', label: 'What’s on repeat', hint: 'Artists you’d fly to see live', done: Boolean(p && (p.music.length || p.artists?.length || p.events.length)) || MUSIC.test(text) },
    { key: 'food', label: 'How you eat', hint: 'Tasting menus, taco trucks, or both', done: Boolean(p?.food.length) || FOOD.test(text) },
    { key: 'crew', label: 'Who you travel with', hint: 'Solo, family, the crew, and how those trips differ', done: Boolean(p?.family.length) || CREW.test(text) },
  ];
}

/** What to talk about for a trip. Heuristic ticks only; the recap is what's built from. */
export function tripChecklist(text: string): ChecklistItem[] {
  return [
    { key: 'where', label: 'Where', hint: 'A place, or just the feeling', done: Boolean(placeFromTypedTrip(text)) },
    { key: 'when', label: 'When', hint: 'Dates, a month, how long', done: WHEN.test(text) },
    { key: 'who', label: 'Who’s coming', hint: 'You, the crew, the kids', done: WHO.test(text) },
    { key: 'must', label: 'Must-do', hint: 'A show, a match, a table', done: MUST.test(text) },
    { key: 'not', label: 'Not doing', hint: 'What to skip', done: NOT.test(text) },
  ];
}

export function checklistFor(mode: VibeMode, text: string): ChecklistItem[] {
  return mode === 'profile' ? profileChecklist(text) : tripChecklist(text);
}

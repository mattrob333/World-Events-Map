import { parseProfileLocally } from '@/lib/designer/profile';
import { wheresIn } from '@/lib/geo/regions';
import { PROFILE_TOPICS, TRIP_TOPICS, type Topic, type TopicMode } from './topics';
import { placeAfterPreposition, placeFromTripRequest, tripCrew } from './vibe';

export type VibeMode = TopicMode;

export interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  core: boolean;
  done: boolean;
  /** What the concierge locked for this topic, in a few words. */
  fact?: string;
}

/** Facts the voice concierge locked, by topic key. */
export type LockedFacts = Readonly<Record<string, string>>;

const CREW = /\b(solo|alone|by myself|friends|the crew|my crew|wife|husband|partner|girlfriend|boyfriend|kids?|son|daughter|family|mom|dad|brother|sister)\b/i;
const MUSIC = /\b(music|concerts?|festivals?|live shows?|band|bands|rapper|dj|playlist|on repeat|listen(?:ing)? to|hip.?hop|jazz|house|techno|country|rock|r&b|edm)\b/i;
const WHEN = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|spring|summer|fall|autumn|winter|weekend|next week|next month|this week|tomorrow|tonight|\d+\s*(?:nights?|days?|weeks?)|\d{1,2}(?:st|nd|rd|th))\b/i;
const WHO = /\b(me and|with (?:my|the|a)|solo|alone|by myself|just me|we're|we are|us|the crew|family|friends|wife|husband|partner|kids?)\b/i;
const MUST = /\b(must|have to|need to|gotta|got to|want to see|non-?negotiable|definitely|can't miss|bucket list)\b/i;
// "No touristy fado", "skip the clubs"; not "I don't know yet".
const NOT = /\b(?:not doing|avoid|skip|without|hate|nothing too|no (?!idea\b|clue\b|plans?\b|rush\b)[a-z]{3,}|don'?t (?:want|like|need)|do not (?:want|like|need))\b/i;
const VIBE = /\b(nights? out|bars?|clubs?|clubbing|party|parties|nightlife|food|foodie|eat(?:ing)?|restaurants?|seafood|tasting|wine|ski(?:ing)?|snow|beach|surf(?:ing)?|culture|museums?|art|galleries|chill|relax(?:ing)?|spa|hiking|adventure|shopping|live music)\b/i;
const PACE = /\b(early (?:riser|bird|start)|up early|late nights?|night owl|out late|slow|chill|laid.?back|packed|non.?stop|go go go|sleep in|lazy)\b/i;
const SPLURGE = /\b(splurge|spend (?:on|big)|save on|budget|cheap|five.?star|luxury|first class|business class|worth (?:it|the money)|money)\b/i;
const BEST = /\b(best trip|favo(?:u)?rite trip|still talk about|never forget|trip of a lifetime|the time we|last (?:year|summer|winter))\b/i;

function build(topics: readonly Topic[], heard: Record<string, boolean>, facts: LockedFacts): ChecklistItem[] {
  return topics.map((topic) => {
    const fact = facts[topic.key]?.trim() || undefined;
    return { key: topic.key, label: topic.label, hint: topic.hint, core: Boolean(topic.core), done: Boolean(fact) || Boolean(heard[topic.key]), fact };
  });
}

/** The profile topics, lit by a locked fact or by the on-device parser hearing it. */
export function profileChecklist(text: string, facts: LockedFacts = {}): ChecklistItem[] {
  const p = text.trim().length >= 3 ? parseProfileLocally(text) : null;
  return build(PROFILE_TOPICS, {
    home: Boolean(p?.hometown),
    crew: Boolean(p?.family.length) || CREW.test(text),
    music: Boolean(p && (p.music.length || p.artists?.length || p.events.length)) || MUSIC.test(text),
    // Lit only when the food words were understood, so it means it's on the board.
    food: Boolean(p?.food.length),
    teams: Boolean(p?.teams.length),
    pace: PACE.test(text),
    splurge: SPLURGE.test(text),
    avoid: NOT.test(text),
    best: BEST.test(text) || Boolean(p?.favoriteTrips.length),
  }, facts);
}

/** The trip topics. Heuristic lights only; the recap is what's built from. */
export function tripChecklist(text: string, facts: LockedFacts = {}): ChecklistItem[] {
  return build(TRIP_TOPICS, {
    where: Boolean(placeFromTripRequest(text) || placeAfterPreposition(text) || wheresIn(text).length),
    when: WHEN.test(text),
    who: WHO.test(text) || Boolean(tripCrew(text)),
    vibe: VIBE.test(text),
    must: MUST.test(text) || NOT.test(text),
  }, facts);
}

export function checklistFor(mode: VibeMode, text: string, facts: LockedFacts = {}): ChecklistItem[] {
  return mode === 'profile' ? profileChecklist(text, facts) : tripChecklist(text, facts);
}

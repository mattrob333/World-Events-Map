import { planPlaceFromQuery, planTripHref, type PlanPlace } from '@/lib/search/planPlace';
import type { VoiceIntent, VoiceToolName } from './tools';

/** Where a page-owned tool lives, so the header's Vibe can open it first. */
export type VibeTarget = { intent: Exclude<VoiceIntent, 'vibe' | 'general'>; href: string };

const TRIP_TOOLS = new Set<VoiceToolName>(['add_traveler', 'remove_traveler', 'create_trip']);

export function vibeTarget(tool: VoiceToolName, args: Record<string, unknown>): VibeTarget | null {
  if (tool === 'describe_me') return { intent: 'board', href: '/moodboard' };
  if (tool === 'set_now_city') return { intent: 'now', href: '/now' };
  if (tool === 'set_trip_basics') {
    const place = typeof args.place === 'string' ? planPlaceFromQuery(args.place) : null;
    // A place opens the designer's setup form even when a trip is in progress.
    return { intent: 'trip', href: place ? planTripHref(place) : '/trips/designer' };
  }
  if (TRIP_TOOLS.has(tool)) return { intent: 'trip', href: '/trips/designer' };
  return null;
}

const ABOUT_ME = /\b(?:i'?m|i am|i love|i like|i live|i grew up|i root|i listen|i travel|my|we love)\b/i;
const TRIP_LEAD = /^\s*(?:(?:i|we)\s+(?:want|wanna|would like|'d like)\s+to\s+go\s+to|let'?s\s+go\s+to|(?:a\s+)?trip\s+to|going\s+to|take\s+(?:me|us)\s+to|to)\s+/i;
const TRIP_BREAK = /\s+(?:in|on|for|with|from|next|this|around|during)\s+/i;
const VAGUE = /^\s*(?:somewhere|anywhere|someplace|something|nowhere)\b/i;

/** The place a typed trip starts with: "Lisbon, second week of October, me and Sam" → Lisbon. */
export function placeFromTypedTrip(text: string): PlanPlace | null {
  const lead = text.replace(TRIP_LEAD, '').split(TRIP_BREAK)[0] ?? '';
  if (VAGUE.test(lead)) return null;
  return planPlaceFromQuery(lead) ?? planPlaceFromQuery(lead.split(',')[0] ?? '');
}

export type TypedVibe = { kind: 'profile' } | { kind: 'trip'; place: PlanPlace | null };

/**
 * What typed text means when voice is off: talk about yourself builds the
 * profile; a place starts a trip. With no profile yet, anything that isn't
 * clearly a trip goes to the profile.
 */
export function readTypedVibe(text: string, hasProfile: boolean): TypedVibe {
  if (ABOUT_ME.test(text)) return { kind: 'profile' };
  const place = placeFromTypedTrip(text);
  if (place) return { kind: 'trip', place };
  return hasProfile ? { kind: 'trip', place: null } : { kind: 'profile' };
}

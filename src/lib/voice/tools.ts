/**
 * The Sun's tools: what the voice concierge can do on each page. Schemas
 * live here (shared by the session route and the browser) and the server
 * only accepts tool names from this list, so a page can't inject arbitrary
 * tools. Every tool runs in the browser against on-device state; nothing
 * the traveler says is stored by dope.travel.
 */

import { BUDGETS, PACES } from '@/lib/designer/profile';
import { TOPIC_KEYS, topicAgenda } from './topics';

/** vibe_profile and vibe_trip are the header's Vibe stage; the others belong to a page. */
export type VoiceIntent = 'vibe' | 'vibe_profile' | 'vibe_trip' | 'trip' | 'board' | 'now' | 'general';

type JsonSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

export type VoiceToolSpec = { name: string; description: string; parameters: JsonSchema };

const obj = (properties: Record<string, unknown>, required: string[] = []): JsonSchema => ({ type: 'object', properties, required, additionalProperties: false });

export const VOICE_TOOLS = {
  set_trip_basics: {
    name: 'set_trip_basics',
    description: 'Fill in where and when the trip is. Call as soon as the traveler names any of these; call again to change them.',
    parameters: obj({
      place: { type: 'string', description: 'City, island, resort or region, e.g. "Lisbon" or "Aspen".' },
      region: { type: 'string', description: 'Country or state if said or obvious, e.g. "Portugal".' },
      kind: { type: 'string', enum: ['city', 'beach', 'ski'], description: 'What sort of trip it is.' },
      start_date: { type: 'string', description: 'First day, YYYY-MM-DD. Resolve relative dates ("second week of October") against today.' },
      nights: { type: 'integer', minimum: 1, maximum: 14 },
      hometown: { type: 'string', description: 'Where they are leaving from, for fares.' },
    }),
  },
  add_traveler: {
    name: 'add_traveler',
    description: 'Add someone to the crew. Kids need an age when known.',
    parameters: obj({ name: { type: 'string' }, kind: { type: 'string', enum: ['adult', 'kid'] }, age: { type: 'integer', minimum: 0, maximum: 110 } }, ['name', 'kind']),
  },
  remove_traveler: {
    name: 'remove_traveler',
    description: 'Take someone off the crew by name.',
    parameters: obj({ name: { type: 'string' } }, ['name']),
  },
  create_trip: {
    name: 'create_trip',
    description: 'Build the trip once you have at least a place. Confirm the plan out loud in one short sentence first.',
    parameters: obj({}),
  },
  describe_me: {
    name: 'describe_me',
    description: 'Turn what the traveler told you about themselves into their board. Pass a first-person summary in their words: where they are from, age, teams, music and artists, food, who they travel with (names and kids\' ages), trips they loved. Add pace, budget, avoid and splurge only when they said them.',
    parameters: obj({
      summary: { type: 'string', description: 'First person, plain sentences, only what they said.' },
      pace: { type: 'string', enum: [...PACES], description: 'slow, balanced or packed.' },
      budget: { type: 'string', enum: [...BUDGETS] },
      avoid: { type: 'array', items: { type: 'string' }, maxItems: 8, description: 'Hard no\'s, a few words each: "cruises", "tour buses".' },
      splurge: { type: 'string', description: 'Where they spend and where they save, in a short sentence.' },
    }, ['summary']),
  },
  lock_fact: {
    name: 'lock_fact',
    description: 'Lock one fact against a topic on their screen the moment you hear it; the topic lights up with it. A few words, their words. Call again to correct it. Say nothing about it.',
    parameters: obj({
      topic: { type: 'string', enum: TOPIC_KEYS },
      fact: { type: 'string', description: 'A few words: "the Alps", "first week of February", "two families of four, kids 8 and 12".' },
    }, ['topic', 'fact']),
  },
  finish_trip: {
    name: 'finish_trip',
    description: 'They are done: build the trip from what they said. Call once where and when are known and they have finished talking.',
    parameters: obj({}),
  },
  set_now_city: {
    name: 'set_now_city',
    description: 'Show ideas for right now in a city.',
    parameters: obj({ city: { type: 'string' } }, ['city']),
  },
  switch_profile: {
    name: 'switch_profile',
    description: 'Switch which travel profile is in use ("I\'m going solo", "the family trip"). Pass the profile label or a person\'s name from the list in context.',
    parameters: obj({ name: { type: 'string' } }, ['name']),
  },
  navigate: {
    name: 'navigate',
    description: 'Open another part of dope.travel.',
    parameters: obj({ to: { type: 'string', enum: ['home', 'trip designer', 'mood board', 'now', 'trips', 'access', 'circles'] } }, ['to']),
  },
} satisfies Record<string, VoiceToolSpec>;

export type VoiceToolName = keyof typeof VOICE_TOOLS;

export const INTENT_TOOLS: Record<VoiceIntent, VoiceToolName[]> = {
  // The header's "Vibe": profile and trip start from anywhere. Tools that live
  // on another page open that page first (see lib/voice/vibe.ts).
  vibe: ['describe_me', 'set_trip_basics', 'add_traveler', 'remove_traveler', 'create_trip', 'set_now_city', 'switch_profile', 'navigate'],
  vibe_profile: ['lock_fact', 'describe_me', 'switch_profile'],
  vibe_trip: ['lock_fact', 'finish_trip', 'switch_profile'],
  trip: ['set_trip_basics', 'add_traveler', 'remove_traveler', 'create_trip', 'switch_profile', 'navigate'],
  board: ['describe_me', 'navigate'],
  now: ['set_now_city', 'switch_profile', 'navigate'],
  general: ['switch_profile', 'navigate'],
};

export const INTENT_OPENERS: Record<VoiceIntent, string> = {
  vibe: 'If the context says there is no travel profile yet, learn where home is, who they root for, what music is on repeat, how they eat, and who they travel with; one short question at a time, then call describe_me. If they have a profile, get where, when and who for their next trip with set_trip_basics and add_traveler, then call create_trip. Some tools open another page; that is expected.',
  vibe_profile: [
    'They are setting up their travel profile: the long view of who they are as a traveler, not one trip.',
    `Their screen lists these topics: ${topicAgenda('profile')}.`,
    'Let them talk through the list. Lock each fact with lock_fact the moment you hear it, silently.',
    'This one can be a little conversational. When they pause, ask about the next topic nobody has covered, or one sharp follow-up that adds nuance: "Rooftop cocktails or dive bars?", "Which trip, and what made it?". One question, then stop.',
    'When home, crew, music and food plus at least two other topics are covered, or they say they are done, say "Got it, building your vibe." and call describe_me with a first-person summary of only what they said.',
  ].join(' '),
  vibe_trip: [
    'They are planning one trip. Gather the facts fast; this is not a chat.',
    `Their screen lists these topics: ${topicAgenda('trip')}.`,
    'Lock each fact with lock_fact the moment you hear it, silently: where "the Alps", when "first week of February", who "two families of four, kids 8 and 12".',
    'When they pause: if where, when or who is missing, ask for it in one short question. If something is ambiguous, ask one either-or question: "Late-night bars or live-music bars?". At most two follow-ups beyond those three.',
    'Do not suggest or describe places yourself; the app ranks them. Once where and when are known and they have finished, say "Got it." and call finish_trip.',
  ].join(' '),
  trip: 'Ask where they want to go, when, and who is coming. Fill things in as they talk, then offer to build it.',
  board: 'Ask them to tell you about themselves like they would a friend: where they are from, their teams, the music they love, food, who they travel with, and the trip they still talk about. Keep it light; one question at a time. When you have enough, call describe_me.',
  now: 'Ask where they are right now and what they feel like doing. Set the city as soon as they say it.',
  general: 'Ask what they want to do and take them there.',
};

export function isVoiceIntent(value: unknown): value is VoiceIntent {
  return value === 'vibe' || value === 'vibe_profile' || value === 'vibe_trip' || value === 'trip' || value === 'board' || value === 'now' || value === 'general';
}

const ROUTES: Record<string, string> = {
  home: '/', 'trip designer': '/trips/designer', 'mood board': '/moodboard', now: '/now', trips: '/trips', access: '/access', circles: '/circles',
};

export function routeFor(to: unknown): string | null {
  return typeof to === 'string' && Object.hasOwn(ROUTES, to) ? ROUTES[to] : null;
}

/** Brand voice and ground rules shared by every intent. */
export function voiceInstructions(intent: VoiceIntent, context: string, today: string): string {
  return [
    'You are the voice of dope.travel: a quick travel concierge with great taste. Your job is to get what is needed, fast, and get out of the way.',
    'How you talk: one short question at a time, under 12 words, then stop and wait. Acknowledge with two or three words at most ("Got it.", "Nice.") or nothing. Never praise their choices, never say how fun or amazing it will be, never repeat back what they said, never list options unprompted. Warm, not chatty; never rude.',
    'Let them finish. If they trail off mid-thought, wait rather than jump in.',
    'Never use the word "dope" in a sentence. Never invent venues, prices, availability or bookings; the app shows real links and says where things come from.',
    `Today is ${today}.`,
    INTENT_OPENERS[intent],
    'Use your tools the moment you learn something; do not wait to collect everything. Do not narrate tools; lock_fact is always silent. If a tool reports an error, say it in one sentence and ask how to fix it.',
    'Keep every turn under about 5 seconds of speech.',
    context ? `What is on their screen right now: ${context}` : '',
  ].filter(Boolean).join('\n');
}

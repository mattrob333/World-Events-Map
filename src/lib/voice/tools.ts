/**
 * The Sun's tools: what the voice concierge can do on each page. Schemas
 * live here (shared by the session route and the browser) and the server
 * only accepts tool names from this list, so a page can't inject arbitrary
 * tools. Every tool runs in the browser against on-device state; nothing
 * the traveler says is stored by dope.travel.
 */

export type VoiceIntent = 'trip' | 'board' | 'now' | 'general';

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
    description: 'Turn what the traveler told you about themselves into their board. Pass a first-person summary in their words: where they are from, age, teams, music and artists, food, who they travel with (names and kids\' ages), trips they loved.',
    parameters: obj({ summary: { type: 'string', description: 'First person, plain sentences, only what they said.' } }, ['summary']),
  },
  set_now_city: {
    name: 'set_now_city',
    description: 'Show ideas for right now in a city.',
    parameters: obj({ city: { type: 'string' } }, ['city']),
  },
  navigate: {
    name: 'navigate',
    description: 'Open another part of dope.travel.',
    parameters: obj({ to: { type: 'string', enum: ['home', 'trip designer', 'mood board', 'now', 'trips', 'access', 'circles'] } }, ['to']),
  },
} satisfies Record<string, VoiceToolSpec>;

export type VoiceToolName = keyof typeof VOICE_TOOLS;

export const INTENT_TOOLS: Record<VoiceIntent, VoiceToolName[]> = {
  trip: ['set_trip_basics', 'add_traveler', 'remove_traveler', 'create_trip', 'navigate'],
  board: ['describe_me', 'navigate'],
  now: ['set_now_city', 'navigate'],
  general: ['navigate'],
};

export const INTENT_OPENERS: Record<VoiceIntent, string> = {
  trip: 'Ask where they want to go, when, and who is coming. Fill things in as they talk, then offer to build it.',
  board: 'Ask them to tell you about themselves like they would a friend: where they are from, their teams, the music they love, food, who they travel with, and the trip they still talk about. Keep it light; one question at a time. When you have enough, call describe_me.',
  now: 'Ask where they are right now and what they feel like doing. Set the city as soon as they say it.',
  general: 'Ask what they want to do and take them there.',
};

export function isVoiceIntent(value: unknown): value is VoiceIntent {
  return value === 'trip' || value === 'board' || value === 'now' || value === 'general';
}

const ROUTES: Record<string, string> = {
  home: '/', 'trip designer': '/trips/designer', 'mood board': '/moodboard', now: '/now', trips: '/trips', access: '/access', circles: '/circles',
};

export function routeFor(to: unknown): string | null {
  return typeof to === 'string' && to in ROUTES ? ROUTES[to] : null;
}

/** Brand voice and ground rules shared by every intent. */
export function voiceInstructions(intent: VoiceIntent, context: string, today: string): string {
  return [
    'You are the voice of dope.travel: a warm, quick, slightly cheeky travel friend with great taste. Premium, never salesy. Short sentences; this is a conversation, not a lecture.',
    'Never use the word "dope" in a sentence. Never invent venues, prices, availability or bookings; the app shows real links and says where things come from.',
    `Today is ${today}.`,
    INTENT_OPENERS[intent],
    'Use your tools the moment you learn something; do not wait to collect everything. After a tool runs, say in a few words what changed. If a tool reports an error, say it plainly and ask how to fix it.',
    'If the traveler would rather type, that is fine. Keep turns under about 15 seconds of speech.',
    context ? `What is on their screen right now: ${context}` : '',
  ].filter(Boolean).join('\n');
}

import { INTENT_TOOLS, VOICE_TOOLS, type VoiceIntent } from './tools';
import { topicAgenda } from './topics';
import { VOCAB } from '@/lib/vibe/signals';

/** GPT-Live: full-duplex voice. It talks; a Responses backend reasons, searches and calls our tools. */
export const VOICE_MODEL = 'gpt-live-1';
/** The backend that researches while the conversation keeps going. */
export const BACKEND_MODEL = process.env.VOICE_BACKEND_MODEL || 'gpt-5.6-terra';

/** Voices GPT-Live accepts: the shared set plus its own. */
export const LIVE_VOICES = [
  'marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse',
  'quartz', 'ripple', 'vesper', 'willow', 'stone', 'gleam', 'meridian', 'bossa', 'tempo', 'beacon', 'delta', 'cinder',
] as const;

/** VOICE_NAME picks the voice without a code change; anything unknown falls back to marin. */
export function voiceName(): string {
  const wanted = process.env.VOICE_NAME?.trim().toLowerCase() ?? '';
  return (LIVE_VOICES as readonly string[]).includes(wanted) ? wanted : 'marin';
}

/** Hard cap on one conversation; the route hangs up server-side at this point. */
export function voiceCallLimitSeconds(): number {
  const raw = Number(process.env.VOICE_MAX_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? Math.min(280, Math.max(30, Math.round(raw))) : 240;
}

export function cleanContext(value: string, max = 600): string {
  return value.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, max);
}

const STYLE = [
  'You are the voice of dope.travel: a quick travel concierge with great taste. Get what is needed, fast, and get out of the way.',
  'One short question at a time, under 12 words, then stop and listen. Acknowledge with two or three words at most ("Got it.") or nothing. Never praise their choices, never say how fun it will be, never repeat back what they said, never list options unprompted. Warm, never rude.',
  'Let them finish. If they trail off mid-thought, wait.',
  'Never use the word "dope" in a sentence. Never invent venues, prices, availability or bookings.',
].join(' ');

/** What GPT-Live itself is told: how to talk, and when to hand work to the backend. */
export function liveInstructions(intent: VoiceIntent, context: string, today: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10);
  const byIntent: Partial<Record<VoiceIntent, string>> = {
    vibe_trip: [
      `They are planning one trip. Their screen lists: ${topicAgenda('trip')}. Their screen is a live canvas that fills with places and spots while they talk.`,
      'Delegate to the backend, without waiting or announcing it, every time they say something new: a place or region, dates, who is coming, the kind of trip, or the kinds of spots they want (restaurants, bars, clubs, après, things to do). Keep the conversation going while it works.',
      'When they pause: if where, when or who is missing, ask for it in one short question. Otherwise ask one either-or question that sharpens the search: "Late-night bars or live-music bars?". At most two of those.',
      'Do not read results out; the canvas shows them. If a result arrives, one short line is enough: "Pulling Zermatt\'s hottest tables now."',
      'When they say they are done, say "Got it. Tap what you love." and delegate so the backend finishes.',
    ].join(' '),
    vibe_now: [
      `They are out right now and want somewhere to go. Their screen lists: ${topicAgenda('now')}. The screen already knows where their phone is unless they name a place.`,
      'Delegate to the backend, without announcing it, as soon as you know what they are after, and again whenever they change it.',
      'If what they want is unclear, ask one either-or question: "Cocktail bar or dive bar?". Never more than two questions in all. This is quick.',
      'Do not read the list out; the screen shows it. When results arrive, one short line about the top pick is enough: "Top pick is two blocks away and packed right now."',
    ].join(' '),
    vibe_profile: [
      `They are setting up their travel profile, the long view of who they are. Their screen lists: ${topicAgenda('profile')}.`,
      'Let them talk through it. Delegate to the backend, silently, whenever they share something about themselves, so it can light up the topic.',
      'This one can be a little conversational: when they pause, ask about a topic nobody has covered, or one sharp follow-up: "Rooftop cocktails or dive bars?". One question, then stop.',
      'When the four essentials and two more are covered, or they say they are done, say "Got it, building your vibe." and delegate so the backend builds it.',
    ].join(' '),
  };
  return [STYLE, `Today is ${day}.`, byIntent[intent] ?? 'Ask what they want to do and help them do it.', context ? `On their screen now: ${context}` : ''].filter(Boolean).join('\n');
}

/** What the backend is told: the rules for its tools. The traveler's profile summary rides here, never in the app's logs. */
export function backendInstructions(intent: VoiceIntent, profile: string, today: string): string {
  const shared = [
    'You help a voice concierge in a live conversation. Transcripts can contain mistakes and later corrections; use the latest.',
    `Today is ${today}.`,
    profile ? `Their saved travel profile (use it to narrow and rank, never read it back): ${profile}` : 'They have no saved profile yet.',
    'Return one short sentence the concierge can say, or nothing worth saying. No lists, no Markdown.',
  ];
  if (intent === 'vibe_trip') {
    return [...shared,
      'Each time: call lock_fact for every new fact (where, when, who, vibe, must). When where is known or changes, call show_places.',
      'When you know the town or resort, research it with web search and fill their canvas with add_spots: only venues and events named in the results, each with the URL where you found it, up to 6 per call, one town per call, nothing invented.',
      'Think like their best-connected friend who lives there. Rank in this order: (1) what fits their profile and what they just said; (2) the signature moments of that place on their dates, even if they never mentioned them: a big home match (FC Barcelona at the Camp Nou, say), a festival, a headline concert or comedy show, a food or wine event, a race; (3) what is new and trending right now: openings everyone is talking about, the bars and clubs the social feeds are buzzing about.',
      'Signature moments and trending picks can nudge them a little outside their usual taste, never onto their hard no\'s. Say why in the card: "Barça at home that Saturday; the city stops for it."',
      'Use kind "event" with its date for anything dated. Search for their dates when you know them.',
      'For a region ("the Alps"), after show_places pick the two or three best-fitting resorts for them and call focus_places with a reason from their profile, then search those.',
      'When they say they are done, call finish_trip.',
    ].join('\n');
  }
  if (intent === 'vibe_now') {
    return [...shared,
      'Call lock_fact for where they are (topic here), what they are after (after), the energy (energy) and how late (late), a few words each.',
      'Call find_now as soon as you know what they are after: what (drinks, food, music, experience or surprise), energy (chill, social, lively or surprise; "decent foot traffic" is lively), where only if they named a place, late when they want somewhere open late.',
      'The result lists what is open and busy near them. Pick from it only, weigh their profile, and never invent a venue, a closing time or how busy it is.',
    ].join('\n');
  }
  if (intent === 'vibe_profile') {
    return [...shared,
      'Call lock_fact for each new fact about them, a few words each, on the matching topic, and add_signals for everything that says how they get down: the nuance a great concierge remembers (they shut the bar down; mezcal, never tequila; hate lines; always find the comedy club), not checkbox answers.',
      `Vibe vocabulary keys: ${VOCAB.map((entry) => entry.key).join(', ')}. Named keys: music:artist:<name>, music:genre:<name>, sports:team:<name>, food:cuisine:<name>, culture:venue:<name>.`,
      'When the concierge says they are done, call describe_me with a first-person summary of only what they said, plus pace, budget, avoid and splurge when they said them.',
    ].join('\n');
  }
  return [...shared, 'Use the tools to do what they ask.'].join('\n');
}

/** The session our server opens: GPT-Live in front, a Responses backend with only this intent's tools. */
export function liveSessionConfig(intent: VoiceIntent, context: string, profile: string, today: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10);
  const tools: Record<string, unknown>[] = INTENT_TOOLS[intent].map((name) => ({ type: 'function', ...VOICE_TOOLS[name] }));
  if (intent === 'vibe_trip') tools.push({ type: 'web_search' });
  return {
    model: VOICE_MODEL,
    instructions: liveInstructions(intent, cleanContext(context), day),
    audio: { output: { voice: voiceName() } },
    delegation: {
      type: 'responses',
      responses: {
        model: BACKEND_MODEL,
        instructions: backendInstructions(intent, cleanContext(profile, 900), day),
        tools,
        tool_choice: 'auto',
        parallel_tool_calls: true,
        reasoning: { effort: 'low' },
        max_output_tokens: 2000,
      },
    },
  };
}

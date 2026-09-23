import 'server-only';
import type { LiveEvent } from '../concerts';

/**
 * Jev (TypeSafe) as a structured judge of musical taste: it reads a
 * listener summary and answers fixed questions (a venue-style choice,
 * probabilities for cover bands and festivals, an energy score), and it
 * scores how well each real event fits that listener. Jev never sees the
 * traveler's identity or Spotify data beyond this summary, and never
 * creates events; it only judges ones a provider returned.
 */

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const TIMEOUT_MS = 10_000;
const MAX_FIT_EVENTS = 8;
const CONCURRENCY = 3;

export const VENUE_STYLES = {
  dive_bar: 'Loud neighborhood bars, pubs, and roadhouses with a band in the corner',
  listening_room: 'Seated listening rooms, jazz clubs, and intimate acoustic sets',
  lounge: 'Stylish lounges, hotel bars, and rooftops with a DJ',
  club: 'Big clubs and late dance floors',
  arena: 'Arena and stadium shows by big names',
  festival: 'Outdoor festivals and multi-day lineups',
} as const;

export type VenueStyle = keyof typeof VENUE_STYLES;

export type MusicPersona = {
  venueStyle: VenueStyle;
  venueConfidence: number;
  /** Probabilities 0–1. */
  coverBands: number;
  festivals: number;
  singAlong: number;
  /** 0–3: background music … front row, all night. */
  energy: number;
  model: string;
};

export function jevConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const unit = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null);

async function ask(state: Obj, questions: Obj, fetchImpl: typeof fetch): Promise<Obj | null> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ state, model: MODEL, questions }),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = obj(await response.json());
    // Never log provider errors verbatim: they can echo headers.
    return typeof payload?.model === 'string' && payload.model.startsWith('jev-') ? payload : null;
  } catch {
    return null;
  }
}

const ENERGY = [
  'Background music: prefers conversation over volume',
  'Casual: enjoys live music with a drink, home by midnight',
  'Into it: sings along, dances a little, stays for the encore',
  'All in: front row, dance floor, last song of the night',
];

export type ListenerSummary = {
  topArtists: string[];
  genres: string[];
  eras: string[];
  listeningHours?: string;
  playlistHabits?: string[];
};

export function parsePersona(payload: Obj | null): MusicPersona | null {
  const answers = obj(payload?.answers);
  const style = obj(answers?.venue_style);
  const covers = obj(answers?.cover_bands);
  const fests = obj(answers?.festivals);
  const sing = obj(answers?.sing_along);
  const energy = obj(answers?.energy);
  if (style?.type !== 'choice' || typeof style.choice !== 'string' || !(style.choice in VENUE_STYLES)) return null;
  const values = [unit(covers?.noul), unit(fests?.noul), unit(sing?.noul)];
  const energyScore = typeof energy?.score === 'number' && energy.score >= 0 && energy.score <= 3 ? energy.score : null;
  if (values.some((value) => value === null) || energyScore === null) return null;
  return {
    venueStyle: style.choice as VenueStyle,
    venueConfidence: unit(style.confidence) ?? 0,
    coverBands: values[0]!,
    festivals: values[1]!,
    singAlong: values[2]!,
    energy: energyScore,
    model: String(payload!.model),
  };
}

export async function jevPersona(summary: ListenerSummary, fetchImpl: typeof fetch = fetch): Promise<MusicPersona | null> {
  const state = {
    top_artists: summary.topArtists.slice(0, 10),
    top_genres: summary.genres.slice(0, 12),
    favorite_eras: summary.eras.slice(0, 4),
    listening_hours: summary.listeningHours ?? null,
    playlist_habits: summary.playlistHabits?.slice(0, 6) ?? [],
    context: 'A traveler choosing what live music to go see and what kind of room to be in while on a trip.',
  };
  const payload = await ask(
    state,
    {
      venue_style: {
        type: 'choice',
        instructions: 'Given this listening, which kind of live-music room would this person most enjoy on a night out while traveling?',
        criteria: VENUE_STYLES,
      },
      cover_bands: {
        type: 'noul',
        instructions: 'Would this person have a great night watching a cover or tribute band play songs by artists like these?',
        criteria: { true: 'Their favorites are well-known, sing-along artists or eras that cover bands commonly play.', false: 'Their taste is niche, instrumental, or electronic, where cover bands are rare or beside the point.' },
      },
      festivals: {
        type: 'noul',
        instructions: 'Would this person travel for a multi-day music festival featuring artists like these?',
      },
      sing_along: {
        type: 'noul',
        instructions: 'Is this person likely to enjoy a room where the crowd sings along to the classics (piano bars, karaoke, anthem nights)?',
      },
      energy: { type: 'score', instructions: 'How much energy does this person want from a night of live music?', criteria: ENERGY },
    },
    fetchImpl,
  );
  return parsePersona(payload);
}

/** Scores events for fit (0–1) against the listener. Only the first few are judged; the rest keep no score. */
export async function jevEventFit(summary: ListenerSummary, events: LiveEvent[], fetchImpl: typeof fetch = fetch): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const batch = events.slice(0, MAX_FIT_EVENTS);
  let cursor = 0;
  async function worker() {
    while (cursor < batch.length) {
      const event = batch[cursor++];
      const payload = await ask(
        {
          listener_top_artists: summary.topArtists.slice(0, 8),
          listener_genres: summary.genres.slice(0, 10),
          listener_eras: summary.eras.slice(0, 3),
          event_name: event.name,
          event_lineup: event.lineup?.slice(0, 12) ?? [],
          event_kind: event.kind,
          venue: event.venue ?? null,
          city: event.city ?? null,
        },
        {
          fit: {
            type: 'score',
            instructions: 'How much would this listener enjoy attending this specific event? Judge only from the supplied names and listening; do not assume facts about the event that are not given.',
            criteria: ['Not their music at all', 'Might enjoy it with friends', 'Solid match for their taste', 'Made for them: a night they would travel for'],
          },
        },
        fetchImpl,
      );
      const fit = obj(obj(payload?.answers)?.fit);
      if (fit?.type === 'score' && typeof fit.score === 'number' && fit.score >= 0 && fit.score <= 3) {
        scores.set(event.id, Math.round((fit.score / 3) * 100) / 100);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));
  return scores;
}

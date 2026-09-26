import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { CARD_INDEX, DESTINATION_INDEX } from '../catalog';
import { candidatesFor, groupTags, type Curation, type Itinerary } from '../itinerary';
import { normalizeProfile, type TravelerProfile } from '../profile';

const MODEL = 'claude-opus-5-5';
// Server-side refusal fallbacks: a declined request is re-run on a fallback
// model inside the same call instead of failing the traveler's request.
const BETAS = ['server-side-fallback-2026-07-01'];

/**
 * Paid AI stays off unless an operator opts in explicitly, so a key added for
 * another feature never starts spending on this one by accident.
 */
export function designerAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.MERIDIAN_DESIGNER_AI === 'on';
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

const ProfileSchema = z.object({
  name: z.string().nullable(),
  age: z.number().int().nullable(),
  hometown: z.string().nullable(),
  heritage: z.array(z.string()),
  teams: z.array(z.string()),
  music: z.array(z.string()),
  artists: z.array(z.string()),
  events: z.array(z.string()),
  family: z.array(
    z.object({
      relation: z.enum(['partner', 'child', 'parent', 'sibling', 'friend', 'other']),
      label: z.string(),
      name: z.string().nullable(),
      age: z.number().int().nullable(),
      note: z.string().nullable(),
    }),
  ),
  favoriteTrips: z.array(z.string()),
  interests: z.array(z.string()),
  food: z.array(z.string()),
  summary: z.string(),
});

const PROFILE_SYSTEM = `You sort a traveler's spoken ramble into a travel profile for a trip-planning Vibe profile.
Record only what the speaker actually said. Never guess ages, names, teams, or nationalities that were not stated; use null or an empty list instead.
Normalize names (for example "the Braves" becomes "Atlanta Braves" only when the speaker's context makes the team unambiguous).
"family" covers the people they travel with; put a partner's stated nationality in that member's "note" and in "heritage".
"music" is genres and styles; "artists" are specific bands and musicians they name (as stated, properly capitalized). "events" are concerts, festivals, and live events they mention. "favoriteTrips" are places they have been and loved.
"summary" is one warm sentence in second person ("You're…") built only from stated facts.
The transcript comes from speech-to-text, so fix obvious transcription slips but do not add facts.`;

function stripNulls<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, v) => (v === null ? undefined : v))) as T;
}

export async function parseProfileWithClaude(transcript: string): Promise<TravelerProfile> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(ProfileSchema) },
    system: PROFILE_SYSTEM,
    messages: [{ role: 'user', content: `<transcript>\n${transcript}\n</transcript>` }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    throw new Error('The AI parser did not return a profile.');
  }
  return normalizeProfile(stripNulls(response.parsed_output));
}

const CurationSchema = z.object({
  days: z.array(
    z.object({
      index: z.number().int(),
      title: z.string(),
      hype: z.string(),
      slots: z.array(z.object({ id: z.string(), cardIds: z.array(z.string()), note: z.string().nullable() })),
    }),
  ),
});

const CURATE_SYSTEM = `You are the trip designer for dope.travel, planning a group trip that should build anticipation and a little FOMO.
You receive a fixed day-by-day timeline of slots and, for every slot, the only idea cards allowed there.
For each slot, return up to 5 card ids from that slot's allowed list, best first, fitting the whole group (ages, kids, interests, heritage, energy across the week).
Vary the week: avoid repeating the same lead card on different days unless the list has nothing else, and pace big days with easier ones.
Write each day's "title" (max 6 words, may start with one emoji) and "hype" (one vivid sentence, max 25 words) about that day's lead picks.
"note" is an optional short reason the lead pick fits this group (max 18 words), or null.
Never invent venues, prices, availability, or bookings. Use only the card ids you were given.`;

function describeGroup(itinerary: Itinerary): string {
  return itinerary.participants
    .map((person) => `- ${person.name} (${person.kind}${person.age ? `, ${person.age}` : ''})${person.tags.length ? `: ${person.tags.join(', ')}` : ''}`)
    .join('\n');
}

export async function curateItineraryWithClaude(base: Itinerary, profileNotes: string[]): Promise<Curation> {
  const destination = DESTINATION_INDEX.get(base.destination)!;
  const tags = groupTags(base.participants);
  const timeline = base.days
    .map((day) => {
      const slots = day.slots
        .map((slot) => {
          const pool = candidatesFor(base.destination, slot.kind, tags)
            .map((card) => `    ${card.id} | ${card.title} | ${card.tags.join(',')}`)
            .join('\n');
          return `  slot ${slot.id} (${slot.label}, ${slot.time})\n${pool}`;
        })
        .join('\n');
      return `Day ${day.index} · ${day.date}\n${slots}`;
    })
    .join('\n\n');

  const prompt = `Destination: ${destination.name}, ${destination.region} (${destination.kind} trip)
Dates: ${base.startDate}, ${base.nights} nights${base.hometown ? `\nTraveling from: ${base.hometown}` : ''}

Group:
${describeGroup(base)}
${profileNotes.length ? `\nFrom their Vibe profiles:\n${profileNotes.map((note) => `- ${note}`).join('\n')}` : ''}

Timeline with allowed cards (id | title | tags):
${timeline}`;

  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(CurationSchema) },
    system: CURATE_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    throw new Error('The AI designer did not return an itinerary.');
  }
  const curation = response.parsed_output;
  return {
    days: curation.days.map((day) => ({
      index: day.index,
      title: day.title,
      hype: day.hype,
      slots: day.slots.map((slot) => ({
        id: slot.id,
        cardIds: slot.cardIds.filter((id) => CARD_INDEX.has(id)),
        note: slot.note ?? undefined,
      })),
    })),
  };
}

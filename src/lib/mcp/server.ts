import 'server-only';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { concertLinks, searchArtistEvents, searchCityScene, searchTeamGames, type EventSource, type LiveEvent } from '@/lib/designer/concerts';
import { curatedOccasions } from '@/lib/designer/occasions';
import { BUDGETS, PACES, SOCIAL_LEVELS, normalizeProfile, parseProfileLocally, summarize, type TravelerProfile } from '@/lib/designer/profile';
import { publicScene, scenePlaybook, sceneSearchLinks } from '@/lib/designer/scene';
import { DESTINATIONS, type DestinationId } from '@/lib/designer/catalog';
import { MAX_NIGHTS, MAX_PARTICIPANTS, composeLocally, isIsoDate, participantStyle, resolveDestination, type Participant } from '@/lib/designer/itinerary';
import { importUrl } from '@/lib/designer/share';
import { partyFrom, staySearches } from '@/lib/designer/stays';
import { tripLink } from '@/lib/designer/tripShare';
import { PlaylistUnavailableError } from '@/lib/designer/spotifyRead';
import { rankTripIdeas } from '@/lib/designer/tripIdeas';
import { consumeProviderCall } from '@/lib/designer/server/guard';
import { PlaylistInputError, readPublicPlaylist, spotifyAppConfigured } from '@/lib/designer/server/spotifyApp';

/**
 * dope.travel for AI agents. A traveler tells their own agent "connect to
 * dope.travel and set up my profile"; the agent interviews them, calls
 * dope_save_profile, and hands back a private import link. Discovery tools
 * return real provider events (Ticketmaster, SeatGeek) and curated
 * occasions, never invented listings. Nothing here books or pays.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const shortList = (max: number, desc: string) => z.array(z.string().min(1).max(80)).max(max).describe(desc);

/** What the traveler sees first, word for word. Five prompts, then they ramble. */
export const OPENING_MESSAGE = `Welcome to dope.travel. Tell me about yourself as a traveler. Ramble, go on tangents, and give every bit of context you can: the more you share, the better your trips get. Type it or talk it, in any order:

1. An experience you loved: where, who you were with, and what made it great.
2. How you like to travel: budget, pace, where you like to stay, and how social you want to be.
3. Food: what you crave, what you go out of your way for, what you avoid.
4. Music: artists, genres, the concerts or festivals you’d travel for (and your teams, if you follow any). Got a Spotify playlist of favorites? Paste the link.
5. Your best moment ever on a trip: the night or day you still tell people about.

No right answers. When you’re done, I’ll build your dope.travel profile.`;

const PROFILE_GUIDE = {
  purpose:
    'dope.travel plans trips that feel made for the traveler: places worth being, the music and teams they love when they get there, and people to share it with.',
  openingMessage: OPENING_MESSAGE,
  howToRun: [
    'Show the opening message as written, then let the traveler talk. Do not turn it into a questionnaire.',
    'While they ramble, silently fill the checklist below. Record only what they say; never guess ages, names, or nationalities.',
    'Afterwards, ask at most two short follow-ups, only for the highest-value gaps (usually: who they travel with, and where they fly from). Skip follow-ups if they seem done.',
    'Call dope_save_profile with the structured fields, their best moments in their own words, their full ramble as `about`, and `spotifyPlaylist` if they pasted a public playlist link.',
    'Give them the returned link and say it keeps their profile private: it saves on their own device.',
  ],
  checklist: {
    identity: 'name (first or nickname), age only if stated, hometown, heritage',
    crew: 'family and friends they travel with: relation, label, name, age, notes (e.g. "Brazilian", "vegetarian")',
    experiences: 'favoriteTrips (places) and bestMoments (1–3 short stories in their words, the heart of the profile)',
    style: `budget (${BUDGETS.join(', ')}), pace (${PACES.join(', ')}), social (${SOCIAL_LEVELS.join(', ')}), lodging (include social hostels if they like meeting people), homeAirport (IATA), avoid, bucketList, languages, notes`,
    food: 'food (cuisines, dishes, favorite kinds of places) and style.dietary',
    music: 'music (genres), events (concerts, festivals), teams (full names)',
    interests: 'activities they mention (skiing, diving, golf, art…)',
  },
  privacy:
    'dope.travel does not store the profile from this tool. It returns a link whose data lives in the URL fragment (never sent to the server); the traveler opens it and saves the profile on their own device. Treat the link as private.',
};

const SERVER_INSTRUCTIONS = `You are connected to dope.travel. As soon as the traveler starts, greet them with this message, word for word, then let them talk:

${OPENING_MESSAGE}

While they talk, extract what you can for their profile (call dope_profile_guide for the full checklist). Ask at most two short follow-ups, then call dope_save_profile and give them the private link it returns. Other tools find events, trip ideas, and live music for their taste.`;

const familySchema = z.object({
  relation: z.enum(['partner', 'child', 'parent', 'sibling', 'friend', 'other']),
  label: z.string().max(30).describe('The word they used: wife, son, best friend…'),
  name: z.string().max(40).optional(),
  age: z.number().int().min(0).max(110).optional(),
  note: z.string().max(60).optional().describe('e.g. "Brazilian", "vegetarian", "hates flying"'),
});

const profileInput = {
  spotifyPlaylist: z.string().max(300).optional().describe('A public Spotify playlist link the traveler shared. Its songs and artists are read into their music profile.'),
  about: z.string().max(12000).optional().describe('The traveler’s full ramble, in their own words. Used to fill any gaps in the structured fields.'),
  profile: z
    .object({
      name: z.string().max(40).optional(),
      age: z.number().int().min(13).max(110).optional(),
      hometown: z.string().max(80).optional(),
      heritage: shortList(6, 'Countries or cultures').optional(),
      teams: shortList(8, 'Full team names').optional(),
      music: shortList(10, 'Genres').optional(),
      events: shortList(10, 'Concerts, festivals, live events').optional(),
      family: z.array(familySchema).max(12).optional(),
      favoriteTrips: shortList(8, 'Places they loved').optional(),
      interests: shortList(14, 'Activities').optional(),
      food: shortList(8, 'Cuisines and dishes').optional(),
      summary: z.string().max(240).optional(),
      bestMoments: z.array(z.string().min(1).max(400)).max(5).optional().describe('Their best moments on trips, 1–3 short stories in their own words'),
      style: z
        .object({
          budget: z.enum(BUDGETS).optional(),
          pace: z.enum(PACES).optional(),
          social: z.enum(SOCIAL_LEVELS).optional(),
          lodging: shortList(6, 'e.g. "social hostel with a bar", "boutique hotel"').optional(),
          homeAirport: z.string().regex(/^[A-Za-z]{3}$/).optional().describe('IATA code, e.g. ATL'),
          dietary: shortList(8, 'Dietary needs').optional(),
          avoid: shortList(10, 'Hard no’s').optional(),
          bucketList: shortList(12, 'Dream trips and experiences').optional(),
          languages: shortList(8, 'Languages spoken').optional(),
          notes: z.string().max(600).optional(),
        })
        .optional(),
    })
    .optional(),
};

function mergeProfiles(structured: TravelerProfile, parsed: TravelerProfile | null): TravelerProfile {
  if (!parsed) return structured;
  const merged: TravelerProfile = { ...structured };
  for (const key of ['heritage', 'teams', 'music', 'events', 'favoriteTrips', 'interests', 'food'] as const) {
    merged[key] = [...new Set([...structured[key], ...parsed[key]])];
  }
  merged.name ??= parsed.name;
  merged.age ??= parsed.age;
  merged.hometown ??= parsed.hometown;
  if (!merged.family.length) merged.family = parsed.family;
  return merged;
}

function missingFields(profile: TravelerProfile): string[] {
  const missing: string[] = [];
  if (!profile.hometown) missing.push('hometown');
  if (!profile.family.length) missing.push('who they travel with');
  if (!profile.music.length && !profile.events.length) missing.push('music and live events');
  if (!profile.teams.length) missing.push('teams (if they follow any)');
  if (!profile.favoriteTrips.length) missing.push('a favorite trip and why');
  if (!profile.bestMoments?.length) missing.push('their best moment on a trip');
  if (!profile.food.length && !profile.style?.dietary.length) missing.push('food');
  if (!profile.style?.budget) missing.push('budget comfort');
  if (!profile.style?.social) missing.push('how social they want to be');
  if (!profile.style?.lodging.length) missing.push('where they like to stay');
  return missing;
}

function providerKeys() {
  const keys = { ticketmaster: process.env.TICKETMASTER_API_KEY || undefined, seatgeek: process.env.SEATGEEK_CLIENT_ID || undefined };
  return { keys, sources: (Object.keys(keys) as EventSource[]).filter((key) => keys[key]) };
}

function result<T extends Record<string, unknown>>(structured: T, text: string) {
  return { content: [{ type: 'text' as const, text }], structuredContent: structured };
}

function failure(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

function eventLine(event: LiveEvent): string {
  const who = event.kind === 'game' ? `${event.team}${event.away ? ' (away)' : ''}` : event.artist ?? '';
  return `- ${event.date} · ${event.name} · ${[event.venue, event.city, event.country].filter(Boolean).join(', ')} · ${event.kind}${who ? ` · ${who}` : ''} · ${event.url}`;
}

const travelerSchema = z.object({
  name: z.string().min(1).max(30),
  kind: z.enum(['adult', 'kid']).optional(),
  age: z.number().int().min(0).max(110).optional(),
});

const CURATED_IDS = DESTINATIONS.map((d) => d.id) as [DestinationId, ...DestinationId[]];

export function createDopeMcpServer(context: { origin: string; request: Request }): McpServer {
  async function readPlaylistSafely(link: string) {
    if (!spotifyAppConfigured()) return { note: 'Playlist reading isn’t set up on this server, so the music came from what they said. They can connect Spotify in the app.' };
    if (!consumeProviderCall(context.request, 'spotify')) return { note: 'Playlist reading is busy right now; try again in a few minutes.' };
    try {
      return { listening: await readPublicPlaylist(link) };
    } catch (cause) {
      if (cause instanceof PlaylistInputError || cause instanceof PlaylistUnavailableError) return { note: cause.message };
      return { note: 'Spotify didn’t respond, so the playlist wasn’t read.' };
    }
  }

  const server = new McpServer({ name: 'dope-travel', version: '1.1.0' }, { instructions: SERVER_INSTRUCTIONS });

  server.registerPrompt(
    'dope_start',
    { title: 'Start my dope.travel profile', description: 'Opens the five-part ramble that builds a traveler profile.' },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Set up my dope.travel profile. Start by showing me this, exactly, then let me ramble:\n\n${OPENING_MESSAGE}`,
          },
        },
      ],
    }),
  );

  server.registerTool(
    'dope_profile_guide',
    {
      title: 'How to build a dope.travel profile',
      description: 'Returns the opening message to show the traveler, how to run the ramble, and the checklist of what to extract. Call this first.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => result(PROFILE_GUIDE, JSON.stringify(PROFILE_GUIDE, null, 2)),
  );

  server.registerTool(
    'dope_save_profile',
    {
      title: 'Save a traveler profile',
      description:
        'Builds a dope.travel profile from structured fields and/or the traveler’s own words, and returns a private import link for the traveler to open and save on their device. Also reports what is still missing so you can ask follow-ups.',
      inputSchema: profileInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ about, profile, spotifyPlaylist }) => {
      if (!about && !profile && !spotifyPlaylist) return failure('Send `profile` fields, `about` text, or both. Call dope_profile_guide for the fields.');
      const structured = normalizeProfile(profile ?? {});
      const merged = mergeProfiles(structured, about ? parseProfileLocally(about) : null);
      const playlist = spotifyPlaylist ? await readPlaylistSafely(spotifyPlaylist) : null;
      const withMusic = playlist?.listening ? { ...merged, listening: playlist.listening } : merged;
      const final = { ...withMusic, summary: withMusic.summary || summarize(withMusic) };
      const url = importUrl(context.origin, final);
      const missing = missingFields(final);
      return result(
        { importUrl: url, profile: final, missing, ...(playlist?.note ? { playlistNote: playlist.note } : {}) },
        `Profile ready. Give the traveler this private link to open and save it on their device:\n${url}\n\n${
          playlist?.listening ? `Read their playlist “${playlist.listening.fromPlaylist}”: ${playlist.listening.topArtists.slice(0, 6).join(', ')}.\n\n` : ''
        }${playlist?.note ? `${playlist.note}\n\n` : ''}${missing.length ? `Still worth asking about: ${missing.join(', ')}.` : 'Nothing important is missing.'}`,
      );
    },
  );

  server.registerTool(
    'dope_find_events',
    {
      title: 'Find events for artists and teams',
      description:
        'Upcoming shows by the traveler’s artists, festivals with them on the lineup, tribute and cover acts, and games for their teams (away games flagged). Real Ticketmaster/SeatGeek listings; returns search links when feeds are not connected.',
      inputSchema: {
        artists: shortList(5, 'Artist names').optional(),
        teams: shortList(4, 'Full team names').optional(),
        city: z.string().max(60).optional().describe('Limit to one city'),
        startDate: date.optional(),
        endDate: date.optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ artists = [], teams = [], city, startDate, endDate }) => {
      if (!artists.length && !teams.length) return failure('Pass at least one artist or team.');
      const { keys, sources } = providerKeys();
      if (!sources.length || !consumeProviderCall(context.request, 'concerts')) {
        const links = concertLinks(artists, city);
        return result({ sources: [], events: [], links }, `Event feeds are not connected right now. Search links:\n${links.map((l) => `- ${l.label}: ${l.href}`).join('\n')}`);
      }
      const [music, games] = await Promise.all([
        artists.length ? searchArtistEvents({ artists, city, startDate, endDate }, keys) : Promise.resolve([]),
        teams.length ? searchTeamGames({ teams, city, startDate, endDate }, keys) : Promise.resolve([]),
      ]);
      const events = [...music, ...games].sort((a, b) => a.date.localeCompare(b.date));
      return result(
        { sources, fetchedAt: new Date().toISOString(), events },
        events.length ? `${events.length} events (${sources.join(' + ')}):\n${events.slice(0, 40).map(eventLine).join('\n')}` : 'No upcoming events found for those artists or teams.',
      );
    },
  );

  server.registerTool(
    'dope_trip_ideas',
    {
      title: 'Rank trip ideas around what they love',
      description:
        'Finds the cities and short windows where the traveler’s artists, festivals, and teams line up, favoring places that also overlap a curated dope.travel occasion. Best first.',
      inputSchema: {
        artists: shortList(5, 'Artist names').optional(),
        teams: shortList(4, 'Full team names').optional(),
        startDate: date.optional(),
        endDate: date.optional(),
        homeCity: z.string().max(80).optional().describe('Excluded from results'),
        maxNights: z.number().int().min(1).max(10).optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ artists = [], teams = [], startDate, endDate, homeCity, maxNights }) => {
      if (!artists.length && !teams.length) return failure('Pass at least one artist or team.');
      const { keys, sources } = providerKeys();
      if (!sources.length || !consumeProviderCall(context.request, 'concerts')) {
        return failure('Event feeds are not connected right now, so trip ideas cannot be ranked. Try dope_curated_occasions instead.');
      }
      const [music, games] = await Promise.all([
        artists.length ? searchArtistEvents({ artists, startDate, endDate }, keys) : Promise.resolve([]),
        teams.length ? searchTeamGames({ teams, startDate, endDate }, keys) : Promise.resolve([]),
      ]);
      const ideas = rankTripIdeas([...music, ...games], { occasions: curatedOccasions({ startDate, endDate }), excludeCity: homeCity, maxNights });
      return result(
        { sources, ideas },
        ideas.length
          ? ideas.map((idea, i) => `${i + 1}. ${idea.city}${idea.country ? `, ${idea.country}` : ''} · ${idea.start} → ${idea.end} · ${idea.why}`).join('\n')
          : 'No city lines up yet for those artists and teams in that window.',
      );
    },
  );

  server.registerTool(
    'dope_live_music_scene',
    {
      title: 'Live music for their taste in a city',
      description:
        'The kinds of nights this traveler would love (e.g. rock cover bands, jazz rooms) and matching listed events in a city and date window, plus map searches for bars with house bands that never list on ticket sites.',
      inputSchema: {
        city: z.string().min(2).max(60),
        genres: shortList(16, 'Genres they listen to'),
        topArtists: shortList(10, 'Favorite artists').optional(),
        eras: z.array(z.object({ decade: z.string().regex(/^\d{4}s$/), share: z.number().min(0).max(1) })).max(5).optional(),
        startDate: date.optional(),
        endDate: date.optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ city, genres, topArtists, eras, startDate, endDate }) => {
      const cityName = city.split(',')[0].trim();
      const playbook = scenePlaybook({ genres: genres.map((g) => g.toLowerCase()), topArtists, eras });
      if (!playbook.length) return failure('Those genres did not map to any live-music scene. Try broader genres like rock, jazz, hip hop, house.');
      const scenes = playbook.map((scene) => ({ ...publicScene(scene), links: sceneSearchLinks(scene, cityName) }));
      const { keys, sources } = providerKeys();
      const events = sources.length && consumeProviderCall(context.request, 'concerts')
        ? await searchCityScene({ city: cityName, startDate, endDate, scenes: playbook.map((s) => s.key) }, keys)
        : [];
      return result(
        { city: cityName, sources, scenes, events },
        `${scenes.map((s) => `${s.emoji} ${s.label}: ${s.why} Look for ${s.venues.join(', ')}. ${s.links[0]?.href ?? ''}`).join('\n')}${
          events.length ? `\n\nListed in ${cityName}:\n${events.slice(0, 20).map(eventLine).join('\n')}` : ''
        }`,
      );
    },
  );

  server.registerTool(
    'dope_curated_occasions',
    {
      title: 'Curated occasions worth traveling for',
      description: 'dope.travel’s editorial calendar of occasions (festivals, races, seasons, openings) in a date window.',
      inputSchema: { startDate: date.optional(), endDate: date.optional(), limit: z.number().int().min(1).max(50).optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ startDate, endDate, limit = 20 }) => {
      const occasions = curatedOccasions({ startDate: startDate ?? new Date().toISOString().slice(0, 10), endDate }).slice(0, limit);
      return result(
        { occasions },
        occasions.map((o) => `- ${o.start} → ${o.end} · ${o.name} · ${o.city} · ${context.origin}${o.href ?? '/'}`).join('\n') || 'No occasions in that window.',
      );
    },
  );

  server.registerTool(
    'dope_read_playlist',
    {
      title: 'Read a Spotify playlist',
      description:
        'Reads a public Spotify playlist link: its top artists, genres, eras, and energy, the same summary the app builds. Use it to learn the traveler’s taste, then pass the link to dope_save_profile.',
      inputSchema: { link: z.string().min(10).max(300).describe('https://open.spotify.com/playlist/…') },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ link }) => {
      const read = await readPlaylistSafely(link);
      if (!read.listening) return failure(read.note ?? 'The playlist could not be read.');
      const l = read.listening;
      return result(
        { listening: l },
        `“${l.fromPlaylist}”: top artists ${l.topArtists.join(', ') || 'none'}; genres ${l.genres.slice(0, 8).join(', ') || 'none listed by Spotify'}; energy ${l.energy}${
          l.eras.length ? `; eras ${l.eras.map((e) => `${e.decade} ${Math.round(e.share * 100)}%`).join(', ')}` : ''
        }.`,
      );
    },
  );

  server.registerTool(
    'dope_plan_trip',
    {
      title: 'Plan a trip',
      description:
        'Lays out a day-by-day trip (morning to late night) for any city, beach, or ski town, shaped by the crew’s food and music, and returns a private link that opens it in dope.travel. Every idea is a live Maps/YouTube/Instagram search, not an invented venue. Also returns stay searches sized to the party.',
      inputSchema: {
        place: z.string().min(2).max(80).optional().describe('Anywhere, e.g. "Lisbon, Portugal". Omit if using a curated destination.'),
        kind: z.enum(['city', 'beach', 'ski']).optional().describe('What kind of trip, for a typed place. Default city.'),
        destination: z.enum(CURATED_IDS).optional().describe('A curated destination id instead of `place`'),
        startDate: date,
        nights: z.number().int().min(1).max(MAX_NIGHTS),
        travelers: z.array(travelerSchema).min(1).max(MAX_PARTICIPANTS).describe('The traveler first, then their crew'),
        hometown: z.string().max(60).optional(),
        foods: shortList(3, 'Favorite foods to look for').optional(),
        music: shortList(8, 'Genres they love').optional(),
        artists: shortList(8, 'Artists they love').optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ place, kind = 'city', destination, startDate, nights, travelers, hometown, foods, music = [], artists = [] }) => {
      if (!isIsoDate(startDate)) return failure('Use a real YYYY-MM-DD start date.');
      if (!place && !destination) return failure('Pass `place` (anywhere) or a curated `destination`.');
      const participants: Participant[] = travelers.map((t, i) => ({
        id: `p${i}`,
        name: t.name.trim().slice(0, 30),
        kind: t.kind ?? (t.age !== undefined && t.age < 18 ? 'kid' : 'adult'),
        age: t.age,
        tags: music.length || artists.length ? ['music'] : [],
        ...participantStyle(i),
      }));
      const [name, ...rest] = (place ?? '').split(',').map((part) => part.trim()).filter(Boolean);
      if (place && !name) return failure('Say where: a city or town name, like "Lisbon, Portugal".');
      const taste = music.length || artists.length ? { genres: music.map((m) => m.toLowerCase()), topArtists: artists } : undefined;
      const trip = composeLocally({
        destination: place ? 'custom' : destination!,
        place: place ? { name: name.slice(0, 60), region: rest.join(', ').slice(0, 60) || undefined, kind } : undefined,
        startDate,
        nights,
        hometown,
        participants,
        foods,
        taste,
      });
      const where = resolveDestination(trip)!;
      const link = await tripLink(context.origin, trip, {}, participants[0].name, { handoff: true });
      const stays = staySearches({ place: [where.name, where.region].filter(Boolean).join(', '), checkIn: startDate, nights: trip.nights, party: partyFrom(participants) });
      const lookup = new Map((trip.cards ?? []).map((card) => [card.id, card]));
      const outline = trip.days
        .map((day) => `Day ${day.index + 1} (${day.date}): ${day.slots.map((slot) => `${slot.label}: ${lookup.get(slot.cardIds[0])?.title ?? slot.note ?? '—'}`).join(' · ')}`)
        .join('\n');
      return result(
        { tripUrl: link, stays, days: trip.days.length, destination: where.name },
        `Trip to ${where.name} ready. Give the traveler this private link; it opens as their trip, and they can invite the crew from there:\n${link}\n\n${outline}\n\nStays for ${participants.length} (search links with dates and guests filled in, not listings):\n${stays.map((s) => `- ${s.label}: ${s.href}`).join('\n')}`,
      );
    },
  );

  server.registerTool(
    'dope_find_stays',
    {
      title: 'Find places to stay',
      description:
        'Airbnb, Vrbo, and Booking.com searches with the dates, adults, kids’ ages, and a bedroom estimate filled in. These are search links, not listings or prices.',
      inputSchema: {
        place: z.string().min(2).max(80),
        checkIn: date,
        nights: z.number().int().min(1).max(30),
        adults: z.number().int().min(1).max(16),
        kidAges: z.array(z.number().int().min(0).max(17)).max(10).optional(),
        lodging: shortList(4, 'Preferences like "social hostel"').optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ place, checkIn, nights, adults, kidAges = [], lodging }) => {
      if (!isIsoDate(checkIn)) return failure('Use a real YYYY-MM-DD check-in date.');
      const stays = staySearches({ place, checkIn, nights, party: { adults, kids: kidAges.length, kidAges }, lodging });
      return result({ stays }, stays.map((s) => `- ${s.label} (${s.note}): ${s.href}`).join('\n'));
    },
  );

  return server;
}

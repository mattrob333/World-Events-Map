import 'server-only';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { EventFeedBudgetError, concertLinks, searchArtistEvents, searchCityScene, searchTeamGames, type LiveEvent } from '@/lib/designer/concerts';
import { curatedOccasions } from '@/lib/designer/occasions';
import { BUDGETS, PACES, SOCIAL_LEVELS, normalizeProfile, parseProfileLocally, summarize, type TravelerProfile } from '@/lib/designer/profile';
import { publicScene, scenePlaybook, sceneSearchLinks } from '@/lib/designer/scene';
import { DESTINATIONS, type DestinationId } from '@/lib/designer/catalog';
import { MAX_NIGHTS, MAX_PARTICIPANTS, composeLocally, isIsoDate, participantStyle, resolveDestination, type Participant } from '@/lib/designer/itinerary';
import { eventKeys, eventSourceLabel, serverCapabilities, type Capabilities } from '@/lib/designer/capabilities';
import { MAX_SHARE_CHARS, encodeProfile, importUrl } from '@/lib/designer/share';
import { partyFrom, staySearches } from '@/lib/designer/stays';
import { tripLink } from '@/lib/designer/tripShare';
import { PlaylistUnavailableError } from '@/lib/designer/spotifyRead';
import { rankTripIdeas } from '@/lib/designer/tripIdeas';
import { consumeProviderCall } from '@/lib/designer/server/guard';
import { PlaylistInputError, readPublicPlaylist } from '@/lib/designer/server/spotifyApp';

/**
 * dope.travel for AI agents. A traveler tells their own agent "connect to
 * dope.travel and set up my profile"; the agent interviews them, calls
 * dope_save_profile, and hands back a private import link. Discovery tools
 * return real provider events (Ticketmaster, SeatGeek) when those feeds are
 * configured, search links when they aren't, and curated occasions; never
 * invented listings. Every promise of live data is worded from
 * serverCapabilities(), read at call time. Nothing here books or pays.
 */

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const shortList = (max: number, desc: string) => z.array(z.string().min(1).max(80)).max(max).describe(desc);

/** What the traveler sees first, word for word. Five prompts, then they ramble. */
export function openingMessage(caps: Pick<Capabilities, 'spotifyPlaylist'> = { spotifyPlaylist: false }): string {
  const playlist = caps.spotifyPlaylist ? ' Got a Spotify playlist of favorites? Paste the link.' : ' Name the artists you love most.';
  return `Welcome to dope.travel. Tell me about yourself as a traveler. Ramble, go on tangents, and give every bit of context you can: the more you share, the better your trips get. Type it or talk it, in any order:

1. An experience you loved: where, who you were with, and what made it great.
2. How you like to travel: budget, pace, where you like to stay, and how social you want to be.
3. Food: what you crave, what you go out of your way for, what you avoid.
4. Music: artists, genres, the concerts or festivals you’d travel for (and your teams, if you follow any).${playlist}
5. Your best moment ever on a trip: the night or day you still tell people about.

No right answers. When you’re done, I’ll build your dope.travel profile.`;
}

/** Plain-language status of each live provider, for agents to relay honestly. */
function providerStatus(caps: Capabilities) {
  return {
    events: caps.events
      ? `Event listings are connected (${eventSourceLabel(caps.eventSources)}). dope_find_events, dope_trip_ideas and dope_live_music_scene return real listings.`
      : 'Event listings (Ticketmaster, SeatGeek) aren’t set up on this server. dope_find_events returns search links instead of listings, dope_trip_ideas can’t rank cities, and dope_live_music_scene gives the kinds of nights to look for with map searches but no dated events. Don’t promise listings.',
    spotifyPlaylist: caps.spotifyPlaylist
      ? 'Public Spotify playlist links can be read (dope_read_playlist, or spotifyPlaylist on dope_save_profile).'
      : 'Spotify isn’t connected on this server, so playlist links can’t be read. Ask the traveler to name their favorite artists instead and pass them as profile.artists.',
  };
}

function profileGuide(caps: Capabilities) {
  return {
    purpose:
      'dope.travel plans trips that feel made for the traveler: places worth being, the music and teams they love when they get there, and people to share it with.',
    whenToUse:
      'Use the opening message when the traveler asks to set up (or redo) their dope.travel profile, or has no profile and wants trips shaped around them. If they asked for a trip, events, or stays first, help with that directly and offer the profile afterwards.',
    openingMessage: openingMessage(caps),
    howToRun: [
      'Show the opening message as written, then let the traveler talk. Do not turn it into a questionnaire.',
      'While they ramble, silently fill the checklist below. Record only what they say; never guess ages, names, or nationalities.',
      'Afterwards, ask at most two short follow-ups, only for the highest-value gaps (usually: who they travel with, and where they fly from). Skip follow-ups if they seem done.',
      caps.spotifyPlaylist
        ? 'Call dope_save_profile with the structured fields, their best moments in their own words, their full ramble as `about`, and `spotifyPlaylist` if they pasted a public playlist link.'
        : 'Call dope_save_profile with the structured fields (including the artists they named), their best moments in their own words, and their full ramble as `about`. Spotify isn’t connected here, so don’t ask for a playlist link.',
      'Give them the returned link. Say that you built it through dope.travel, which didn’t keep a copy, and that opening it saves the profile on their own device.',
    ],
    checklist: {
      identity: 'name (first or nickname), age only if stated, hometown, heritage',
      crew: 'family and friends they travel with: relation, label, name, age, notes (e.g. "Brazilian", "vegetarian")',
      experiences: 'favoriteTrips (places) and bestMoments (1–3 short stories in their words, the heart of the profile)',
      style: `budget (${BUDGETS.join(', ')}), pace (${PACES.join(', ')}), social (${SOCIAL_LEVELS.join(', ')}), lodging (include social hostels if they like meeting people), homeAirport (IATA), avoid, bucketList, languages, notes`,
      food: 'food (cuisines, dishes, favorite kinds of places) and style.dietary',
      music: 'artists (the bands and singers they name), music (genres), events (concerts, festivals), teams (full names)',
      interests: 'activities they mention (skiing, diving, golf, art…)',
    },
    liveData: providerStatus(caps),
    connectionCheck: 'If you can read this guide, the dope.travel connection works.',
    privacy:
      'dope.travel processes this call to build the link and does not keep a copy of the profile. The data lives in the link’s fragment (the part after #, which browsers never send to a server); the traveler opens it and saves the profile on their own device. Treat the link as private.',
  };
}

function serverInstructions(caps: Capabilities): string {
  return `You are connected to dope.travel, which plans trips around a traveler's music, teams, food and crew.

When the traveler asks to set up their dope.travel profile (or has none yet and wants trips shaped around them), greet them with this message, word for word, then let them talk:

${openingMessage(caps)}

If instead they ask for a trip, events or stays first, help with that directly and offer the profile afterwards; don't open with the five prompts.

While they talk, extract what you can for their profile (call dope_profile_guide for the full checklist). Ask at most two short follow-ups, then call dope_save_profile and give them the private link it returns. Other tools plan trips, find stays, events, trip ideas and live music for their taste.

What's live on this server: ${providerStatus(caps).events} ${providerStatus(caps).spotifyPlaylist}`;
}

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
      artists: shortList(10, 'Artists and bands they named').optional(),
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
  const artists = [...new Set([...(structured.artists ?? []), ...(parsed.artists ?? [])])];
  if (artists.length) merged.artists = artists;
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
  if (!profile.music.length && !profile.events.length && !profile.artists?.length) missing.push('music and live events');
  else if (!profile.artists?.length && !profile.listening) missing.push('a few favorite artists');
  if (!profile.teams.length) missing.push('teams (if they follow any)');
  if (!profile.favoriteTrips.length) missing.push('a favorite trip and why');
  if (!profile.bestMoments?.length) missing.push('their best moment on a trip');
  if (!profile.food.length && !profile.style?.dietary.length) missing.push('food');
  if (!profile.style?.budget) missing.push('budget comfort');
  if (!profile.style?.social) missing.push('how social they want to be');
  if (!profile.style?.lodging.length) missing.push('where they like to stay');
  return missing;
}

/** Search links for teams when event listings aren't available. */
function teamLinks(teams: string[], city?: string) {
  return teams.flatMap((team) => [
    { team, label: `${team} games on Ticketmaster`, href: `https://www.ticketmaster.com/search?q=${encodeURIComponent(team)}` },
    { team, label: `${team} schedule`, href: `https://www.google.com/search?q=${encodeURIComponent(`${team} schedule${city ? ` ${city}` : ''}`)}` },
  ]);
}

/** Today in UTC, a day early so a traveler west of UTC can still start "today". */
function earliestDate(now = new Date()): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
}

function pastDate(value: string | undefined, label: string): string | null {
  return value && value < earliestDate() ? `${label} ${value} is in the past. Use a date from today on.` : null;
}

/**
 * A soft check that a typed place is a place: letters, a vowel in each word,
 * no long consonant runs or keyboard mashing. Real names still pass
 * ("Szczecin", "Llanfairpwllgwyngyll", "São Paulo", "東京").
 */
export function looksLikePlace(value: string): boolean {
  const text = value.normalize('NFC').trim();
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 2 || letters < text.replace(/\s/g, '').length * 0.6) return false;
  if (/https?:|www\.|@|[<>{}]/i.test(text)) return false;
  if (/asdf|qwer|zxcv|hjkl|sdfg|dfgh|xcvb|uiop/i.test(text)) return false;
  return text
    .split(/[\s,.'’-]+/)
    .filter((word) => /^[a-z]+$/i.test(word))
    .every((word) => word.length < 3 || (/[aeiouyw]/i.test(word) && !/[^aeiouyw\s]{6,}/i.test(word)));
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
    if (!serverCapabilities().spotifyPlaylist) {
      return { note: 'Spotify isn’t connected on this server, so the playlist wasn’t read and the music came from what they said. Ask them to name a few favorite artists.' };
    }
    if (!consumeProviderCall(context.request, 'spotify')) return { note: 'Playlist reading is busy right now; try again in a few minutes.' };
    try {
      return { listening: await readPublicPlaylist(link) };
    } catch (cause) {
      if (cause instanceof PlaylistInputError || cause instanceof PlaylistUnavailableError) return { note: cause.message };
      return { note: 'Spotify didn’t respond, so the playlist wasn’t read.' };
    }
  }

  // Tool descriptions and instructions are built per request, so they follow the server's current config.
  const caps = serverCapabilities();
  const server = new McpServer({ name: 'dope-travel', version: '1.2.0' }, { instructions: serverInstructions(caps) });

  server.registerPrompt(
    'dope_start',
    { title: 'Start my dope.travel profile', description: 'Opens the five-part ramble that builds a traveler profile.' },
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Set up my dope.travel profile. Start by showing me this, exactly, then let me ramble:\n\n${openingMessage(serverCapabilities())}`,
          },
        },
      ],
    }),
  );

  server.registerTool(
    'dope_profile_guide',
    {
      title: 'How to build a dope.travel profile',
      description:
        'Returns the opening message to show the traveler, how to run the ramble, the checklist of what to extract, and which live data (events, Spotify) this server has. Call this first; it also confirms the connection works.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const guide = profileGuide(serverCapabilities());
      return result(guide, JSON.stringify(guide, null, 2));
    },
  );

  server.registerTool(
    'dope_save_profile',
    {
      title: 'Save a traveler profile',
      description: `Builds a dope.travel profile from structured fields and/or the traveler’s own words, and returns a private import link for the traveler to open and save on their device. dope.travel doesn’t keep a copy. Also reports what is still missing so you can ask follow-ups.${
        caps.spotifyPlaylist ? '' : ' Spotify isn’t connected on this server: put the artists they name in profile.artists.'
      }`,
      inputSchema: profileInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: caps.spotifyPlaylist },
    },
    async ({ about, profile, spotifyPlaylist }) => {
      if (!about && !profile && !spotifyPlaylist) return failure('Send `profile` fields, `about` text, or both. Call dope_profile_guide for the fields.');
      const structured = normalizeProfile(profile ?? {});
      // Merging can push lists past their caps, so the result is normalized again.
      const merged = normalizeProfile(mergeProfiles(structured, about ? parseProfileLocally(about) : null));
      const playlist = spotifyPlaylist ? await readPlaylistSafely(spotifyPlaylist) : null;
      const withMusic = playlist?.listening ? normalizeProfile({ ...merged, listening: playlist.listening }) : merged;
      const final = { ...withMusic, summary: withMusic.summary || summarize(withMusic) };
      const encoded = encodeProfile(final);
      if (encoded.length > MAX_SHARE_CHARS) {
        return failure(
          `The profile is too big to fit in a link (${encoded.length.toLocaleString('en-US')} characters; the limit is ${MAX_SHARE_CHARS.toLocaleString('en-US')}). Shorten bestMoments and style.notes, send fewer list items, or leave out \`about\` if the structured fields already cover it, then call dope_save_profile again.`,
        );
      }
      const url = importUrl(context.origin, final);
      const missing = missingFields(final);
      return result(
        { importUrl: url, profile: final, missing, ...(playlist?.note ? { playlistNote: playlist.note } : {}) },
        `Profile ready. Give the traveler this private link; opening it saves the profile on their device. dope.travel built it without keeping a copy:\n${url}\n\n${
          playlist?.listening ? `Read their playlist “${playlist.listening.fromPlaylist}”: ${playlist.listening.topArtists.slice(0, 6).join(', ')}.\n\n` : ''
        }${playlist?.note ? `${playlist.note}\n\n` : ''}${missing.length ? `Still worth asking about: ${missing.join(', ')}.` : 'Nothing important is missing.'}`,
      );
    },
  );

  server.registerTool(
    'dope_find_events',
    {
      title: 'Find events for artists and teams',
      description: caps.events
        ? `Upcoming shows by the traveler’s artists, festivals with them on the lineup, tribute and cover acts, and games for their teams (away games flagged). Real ${eventSourceLabel(caps.eventSources)} listings.`
        : 'Event listings aren’t set up on this server, so this returns search links (Ticketmaster, Bandsintown, team schedules) for the traveler’s artists and teams, not listings.',
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
      const past = pastDate(endDate, 'endDate');
      if (past) return failure(past);
      const { keys, sources } = eventKeys();
      const linksOnly = (why: string, listings: string) => {
        const links = [...concertLinks(artists, city), ...teamLinks(teams, city)];
        return result({ sources: [], events: [], links, listings }, `${why}\n${links.map((l) => `- ${l.label}: ${l.href}`).join('\n')}`);
      };
      if (!sources.length) return linksOnly('Event listings aren’t set up on this server, so these are search links, not listings:', 'not-configured');
      if (!consumeProviderCall(context.request, 'concerts')) {
        return linksOnly('Event listings are busy right now (too many searches in a few minutes), so here are search links instead:', 'busy');
      }
      let music: LiveEvent[];
      let games: LiveEvent[];
      try {
        [music, games] = await Promise.all([
          artists.length ? searchArtistEvents({ artists, city, startDate, endDate }, keys) : Promise.resolve([]),
          teams.length ? searchTeamGames({ teams, city, startDate, endDate }, keys) : Promise.resolve([]),
        ]);
      } catch (cause) {
        if (cause instanceof EventFeedBudgetError) return linksOnly(`${cause.message} Search links:`, 'daily-limit');
        throw cause;
      }
      const events = [...music, ...games].sort((a, b) => a.date.localeCompare(b.date));
      return result(
        { sources, fetchedAt: new Date().toISOString(), events },
        events.length
          ? `${events.length} events (${eventSourceLabel(sources)}):\n${events.slice(0, 40).map(eventLine).join('\n')}`
          : `No upcoming events found on ${eventSourceLabel(sources)} for those artists or teams.`,
      );
    },
  );

  server.registerTool(
    'dope_trip_ideas',
    {
      title: 'Rank trip ideas around what they love',
      description: caps.events
        ? 'Finds the cities and short windows where the traveler’s artists, festivals, and teams line up, favoring places that also overlap a curated dope.travel occasion. Best first.'
        : 'Ranks cities where the traveler’s artists and teams line up. Needs event listings, which aren’t set up on this server; use dope_curated_occasions instead.',
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
      const past = pastDate(endDate, 'endDate');
      if (past) return failure(past);
      const { keys, sources } = eventKeys();
      if (!sources.length) return failure('Event listings aren’t set up on this server, so trip ideas can’t be ranked. Try dope_curated_occasions instead.');
      if (!consumeProviderCall(context.request, 'concerts')) return failure('Event listings are busy right now; try again in a few minutes, or use dope_curated_occasions.');
      let music: LiveEvent[];
      let games: LiveEvent[];
      try {
        [music, games] = await Promise.all([
          artists.length ? searchArtistEvents({ artists, startDate, endDate }, keys) : Promise.resolve([]),
          teams.length ? searchTeamGames({ teams, startDate, endDate }, keys) : Promise.resolve([]),
        ]);
      } catch (cause) {
        if (cause instanceof EventFeedBudgetError) return failure(`${cause.message} Try dope_curated_occasions meanwhile.`);
        throw cause;
      }
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
      description: caps.events
        ? 'The kinds of nights this traveler would love (e.g. rock cover bands, jazz rooms) and matching listed events in a city and date window, plus map searches for bars with house bands that never list on ticket sites.'
        : 'The kinds of nights this traveler would love (e.g. rock cover bands, jazz rooms) in a city, with map searches for the rooms to look for. Event listings aren’t set up on this server, so no dated events are included.',
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
      if (!looksLikePlace(cityName)) return failure(`“${cityName}” doesn’t look like a city. Pass a real city name, like "Austin" or "Lisbon, Portugal".`);
      const past = pastDate(endDate, 'endDate');
      if (past) return failure(past);
      const playbook = scenePlaybook({ genres: genres.map((g) => g.toLowerCase()), topArtists, eras });
      if (!playbook.length) return failure('Those genres did not map to any live-music scene. Try broader genres like rock, jazz, hip hop, house.');
      const scenes = playbook.map((scene) => ({ ...publicScene(scene), links: sceneSearchLinks(scene, cityName) }));
      const { keys, sources } = eventKeys();
      let busy = sources.length > 0 && !consumeProviderCall(context.request, 'concerts');
      let limitNote = '';
      let events: LiveEvent[] = [];
      if (sources.length && !busy) {
        try {
          events = await searchCityScene({ city: cityName, startDate, endDate, scenes: playbook.map((s) => s.key) }, keys);
        } catch (cause) {
          if (!(cause instanceof EventFeedBudgetError)) throw cause;
          busy = true;
          limitNote = `\n\n${cause.message}`;
        }
      }
      const listingNote = !sources.length
        ? '\n\nEvent listings aren’t set up on this server, so there are no dated events here. The map searches above are the way in.'
        : busy
          ? limitNote || '\n\nEvent listings are busy right now, so dated events were skipped; try again in a few minutes.'
          : events.length
            ? `\n\nListed in ${cityName} (${eventSourceLabel(sources)}):\n${events.slice(0, 20).map(eventLine).join('\n')}`
            : `\n\nNothing matching is listed on ${eventSourceLabel(sources)} in ${cityName} for those dates.`;
      return result(
        { city: cityName, sources: busy ? [] : sources, scenes, events, listings: !sources.length ? 'not-configured' : busy ? 'busy' : 'ok' },
        `${scenes.map((s) => `${s.emoji} ${s.label}: ${s.why} Look for ${s.venues.join(', ')}. ${s.links[0]?.href ?? ''}`).join('\n')}${listingNote}`,
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
      description: caps.spotifyPlaylist
        ? 'Reads a public Spotify playlist link: its top artists, genres, eras, and energy, the same summary the app builds. Use it to learn the traveler’s taste, then pass the link to dope_save_profile.'
        : 'Spotify isn’t connected on this server, so playlist links can’t be read. Ask the traveler to name their favorite artists and pass them as profile.artists to dope_save_profile.',
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
        'Lays out a day-by-day trip (morning to late night) for any city, beach, or ski town, shaped by the crew’s food and music, and returns a private link that opens it in dope.travel as the traveler’s own trip, taste included. Every idea is a live Maps/YouTube/Instagram search, not an invented venue. Also returns stay searches sized to the party.',
      inputSchema: {
        place: z.string().min(2).max(80).optional().describe('Anywhere, e.g. "Lisbon, Portugal". Omit if using a curated destination.'),
        kind: z.enum(['city', 'beach', 'ski']).optional().describe('What kind of trip, for a typed place. Default city.'),
        destination: z.enum(CURATED_IDS).optional().describe('A curated destination id instead of `place`'),
        startDate: date.describe('First day, today or later'),
        nights: z.number().int().min(1).max(MAX_NIGHTS),
        travelers: z.array(travelerSchema).min(1).max(MAX_PARTICIPANTS).describe('The traveler first, then their crew'),
        hometown: z.string().max(60).optional(),
        foods: shortList(3, 'Favorite foods to look for').optional(),
        music: shortList(8, 'Genres they love').optional(),
        artists: shortList(8, 'Artists they love').optional(),
      },
      // The link it returns opens a page that looks the place up live.
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ place, kind = 'city', destination, startDate, nights, travelers, hometown, foods, music = [], artists = [] }) => {
      if (!isIsoDate(startDate)) return failure('Use a real YYYY-MM-DD start date.');
      const past = pastDate(startDate, 'startDate');
      if (past) return failure(past);
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
      if (place && !looksLikePlace(place)) return failure(`“${place}” doesn’t look like a place. Ask the traveler where they want to go, then pass a city or town, like "Lisbon, Portugal".`);
      const taste = music.length || artists.length ? { genres: music.map((m) => m.toLowerCase()), topArtists: artists } : undefined;
      const composed = composeLocally({
        destination: place ? 'custom' : destination!,
        place: place ? { name: name.slice(0, 60), region: rest.join(', ').slice(0, 60) || undefined, kind } : undefined,
        startDate,
        nights,
        hometown,
        participants,
        foods,
        taste,
      });
      // The traveler's own trip keeps their taste (UFR2-H12); invites they send later still strip it.
      const trip = taste ? { ...composed, taste } : composed;
      const where = resolveDestination(trip)!;
      const link = await tripLink(context.origin, trip, {}, participants[0].name, { handoff: true, includeTaste: true });
      const stays = staySearches({ place: [where.name, where.region].filter(Boolean).join(', '), checkIn: startDate, nights: trip.nights, party: partyFrom(participants) });
      const lookup = new Map((trip.cards ?? []).map((card) => [card.id, card]));
      const skiTrip = (place ? kind : where.kind) === 'ski';
      const outline = trip.days
        .map((day) => {
          const slots = day.slots
            .filter((slot) => skiTrip || slot.kind !== 'apres')
            .map((slot) => ({ label: slot.label, what: lookup.get(slot.cardIds[0])?.title ?? slot.note }))
            .filter((slot) => slot.what);
          return `Day ${day.index + 1} (${day.date}): ${slots.length ? slots.map((slot) => `${slot.label}: ${slot.what}`).join(' · ') : 'open'}`;
        })
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
        checkIn: date.describe('Today or later'),
        nights: z.number().int().min(1).max(30),
        adults: z.number().int().min(1).max(16),
        kidAges: z.array(z.number().int().min(0).max(17)).max(10).optional(),
        lodging: shortList(4, 'Preferences like "social hostel"').optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ place, checkIn, nights, adults, kidAges = [], lodging }) => {
      if (!isIsoDate(checkIn)) return failure('Use a real YYYY-MM-DD check-in date.');
      const past = pastDate(checkIn, 'checkIn');
      if (past) return failure(past);
      if (!looksLikePlace(place)) return failure(`“${place}” doesn’t look like a place. Pass a city, town, or neighborhood, like "Lisbon, Portugal".`);
      const stays = staySearches({ place, checkIn, nights, party: { adults, kids: kidAges.length, kidAges }, lodging });
      return result({ stays }, stays.map((s) => `- ${s.label} (${s.note}): ${s.href}`).join('\n'));
    },
  );

  return server;
}

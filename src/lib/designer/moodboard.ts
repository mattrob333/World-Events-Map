import { listeningInsights } from './listening';
import type { TravelerProfile } from './profile';

/**
 * Bento board: a handful of grouped cards (home, crew, teams, sound…) in a
 * tidy grid. Each card carries its own list, so the board stays calm even
 * when the ramble was long.
 */
export type BentoSize = 'xl' | 'wide' | 'tall' | 'sm';

export type BentoItem = { label: string; emoji?: string; sub?: string };

export type BentoCard = {
  id: string;
  kind: 'home' | 'crew' | 'teams' | 'roots' | 'sound' | 'vibe' | 'live' | 'trips' | 'into' | 'food';
  eyebrow: string;
  title: string;
  body?: string;
  items?: BentoItem[];
  meters?: { label: string; value: number }[];
  emoji: string;
  palette: [string, string];
  /** Editorial mood imagery (not a photo of the traveler or the exact place). */
  image?: string;
  size: BentoSize;
};

const TEAM_COLORS: Record<string, [string, string]> = {
  'Atlanta Braves': ['#13274F', '#CE1141'], 'Atlanta Falcons': ['#A71930', '#111111'], 'Atlanta Hawks': ['#E03A3E', '#C1D32F'],
  'Atlanta United': ['#80000A', '#A19060'], 'New York Yankees': ['#0C2340', '#C4CED3'], 'Los Angeles Lakers': ['#552583', '#FDB927'],
  'Boston Red Sox': ['#BD3039', '#0C2340'], 'Chicago Cubs': ['#0E3386', '#CC3433'], 'Dallas Cowboys': ['#003594', '#869397'],
  'Golden State Warriors': ['#1D428A', '#FFC72C'], 'Miami Heat': ['#98002E', '#F9A01B'], 'Georgia Bulldogs': ['#BA0C2F', '#000000'],
  Flamengo: ['#C4161C', '#111111'], Liverpool: ['#C8102E', '#00B2A9'], Arsenal: ['#EF0107', '#063672'],
  'Kansas City Chiefs': ['#E31837', '#FFB81C'],
};

const COUNTRY: Record<string, { flag: string; palette: [string, string] }> = {
  Brazil: { flag: '🇧🇷', palette: ['#009C3B', '#FFDF00'] }, Mexico: { flag: '🇲🇽', palette: ['#006847', '#CE1126'] },
  Colombia: { flag: '🇨🇴', palette: ['#FCD116', '#003893'] }, Argentina: { flag: '🇦🇷', palette: ['#74ACDF', '#F6B40E'] },
  Italy: { flag: '🇮🇹', palette: ['#009246', '#CE2B37'] }, France: { flag: '🇫🇷', palette: ['#002395', '#ED2939'] },
  Germany: { flag: '🇩🇪', palette: ['#111111', '#DD0000'] }, Switzerland: { flag: '🇨🇭', palette: ['#DA291C', '#FFFFFF'] },
  Spain: { flag: '🇪🇸', palette: ['#AA151B', '#F1BF00'] }, Portugal: { flag: '🇵🇹', palette: ['#046A38', '#DA291C'] },
  Ireland: { flag: '🇮🇪', palette: ['#169B62', '#FF883E'] }, 'United Kingdom': { flag: '🇬🇧', palette: ['#012169', '#C8102E'] },
  Nigeria: { flag: '🇳🇬', palette: ['#008751', '#FFFFFF'] }, Jamaica: { flag: '🇯🇲', palette: ['#009B3A', '#FED100'] },
  Japan: { flag: '🇯🇵', palette: ['#BC002D', '#FFFFFF'] }, Korea: { flag: '🇰🇷', palette: ['#003478', '#C60C30'] },
  India: { flag: '🇮🇳', palette: ['#FF9933', '#138808'] }, Greece: { flag: '🇬🇷', palette: ['#0D5EAF', '#FFFFFF'] },
  Cuba: { flag: '🇨🇺', palette: ['#002A8F', '#CB1515'] }, Canada: { flag: '🇨🇦', palette: ['#D80621', '#FFFFFF'] },
};

const CITY_PALETTE: Record<string, { emoji: string; palette: [string, string] }> = {
  atlanta: { emoji: '🍑', palette: ['#F97316', '#DC2626'] }, 'new york': { emoji: '🗽', palette: ['#1E293B', '#FACC15'] },
  miami: { emoji: '🌴', palette: ['#EC4899', '#06B6D4'] }, chicago: { emoji: '🌬️', palette: ['#1D4ED8', '#E11D48'] },
  'los angeles': { emoji: '🌅', palette: ['#F59E0B', '#8B5CF6'] }, nashville: { emoji: '🎸', palette: ['#B45309', '#1E3A8A'] },
  austin: { emoji: '🤠', palette: ['#BF5700', '#333F48'] }, london: { emoji: '💂', palette: ['#1E3A8A', '#DC2626'] },
  'são paulo': { emoji: '🌆', palette: ['#16A34A', '#FACC15'] },
};

const MUSIC_EMOJI: [RegExp, string, [string, string]][] = [
  [/hip ?hop|rap|trap/i, '🎤', ['#7C3AED', '#F59E0B']], [/house|techno|edm|electronic|disco|dance/i, '🪩', ['#DB2777', '#6366F1']],
  [/rock|grunge|punk|metal/i, '🎸', ['#111827', '#EF4444']], [/jazz|blues|soul|motown|r&b/i, '🎷', ['#1E3A8A', '#F59E0B']],
  [/samba|bossa|mpb|latin|salsa|reggaeton/i, '🥁', ['#16A34A', '#FACC15']], [/country|bluegrass|americana|folk/i, '🤠', ['#92400E', '#FDE68A']],
  [/reggae|afrobeats/i, '🌞', ['#15803D', '#EAB308']], [/classical|opera/i, '🎻', ['#44403C', '#E7E5E4']],
];

const INTEREST_IMAGE: [RegExp, string, string][] = [
  [/ski|snowboard/i, '/editorial/niseko-january-powder.jpg', '⛷️'], [/beach|snorkel|diving|surf/i, '/editorial/tonga-humpback-swim.jpg', '🏝️'],
  [/sailing|boating/i, '/editorial/les-voiles-de-saint-tropez.jpg', '⛵'], [/wine/i, '/editorial/san-sebastian-gastronomika.jpg', '🍷'],
  [/art|museum/i, '/editorial/venice-biennale-arte.jpg', '🖼️'], [/golf/i, '', '⛳'], [/hiking|adventure/i, '/editorial/torres-del-paine-puma.jpg', '🥾'],
  [/tennis/i, '/editorial/laver-cup.jpg', '🎾'], [/concert|festival|live music/i, '/editorial/coachella-weekend-two.jpg', '🎟️'],
  [/spa|yoga|wellness/i, '', '🧘'], [/nightlife|cocktail/i, '', '🍸'], [/fishing/i, '', '🎣'], [/photography/i, '/editorial/kyoto-autumn-koyo.jpg', '📸'],
];

const TRIP_IMAGE: [RegExp, string][] = [
  [/aspen/i, '/editorial/destination-aspen-hero.jpg'], [/st\.? moritz/i, '/editorial/destination-st-moritz-lake.jpg'],
  [/courchevel/i, '/editorial/destination-courchevel-village.jpg'], [/kyoto|japan/i, '/editorial/kyoto-cherry-blossom.jpg'],
  [/niseko/i, '/editorial/destination-niseko-yotei.jpg'], [/maldives/i, '/editorial/hanifaru-manta-aggregation.jpg'],
  [/gstaad/i, '/editorial/destination-gstaad-palace.jpg'], [/jackson|teton/i, '/editorial/destination-teton-tram.jpg'],
  [/zermatt/i, '/editorial/zermatt-march-high-season.jpg'], [/munich|oktoberfest/i, '/editorial/oktoberfest-munich.jpg'],
  [/paris/i, '/editorial/paris-fashion-week-ss27.jpg'], [/venice/i, '/editorial/venice-biennale-arte.jpg'],
  [/galap/i, '/editorial/galapagos-cool-season.jpg'], [/kenya|mara|safari|tanzania/i, '/editorial/mara-river-crossing.jpg'],
  [/monaco/i, '/editorial/monaco-yacht-show.jpg'], [/saint[- ]tropez|st\.? tropez/i, '/editorial/les-voiles-de-saint-tropez.jpg'],
  [/verbier/i, '/editorial/verbier-february-half-term.jpg'], [/queenstown/i, '/editorial/cardrona-queenstown-peak.jpg'],
];

const TRIP_PALETTES: [string, string][] = [['#0EA5E9', '#22D3EE'], ['#F43F5E', '#FB923C'], ['#8B5CF6', '#EC4899'], ['#10B981', '#84CC16']];

const FAMILY_EMOJI: Record<string, string> = { partner: '💞', child: '🧒', parent: '🏡', sibling: '🤝', friend: '🫶', other: '✨' };

function kidEmoji(label: string, age?: number): string {
  const girl = /daughter|girl/i.test(label);
  if (age !== undefined && age < 5) return '👶';
  return girl ? '👧' : /son|boy/i.test(label) ? '👦' : '🧒';
}

function teamEmoji(team: string): string {
  if (/braves|yankees|red sox|cubs|dodgers|mets|astros/i.test(team)) return '⚾';
  if (/falcons|cowboys|chiefs|bulldogs|eagles|49ers|crimson|packers|steelers|saints/i.test(team)) return '🏈';
  if (/hawks|lakers|heat|warriors|celtics|knicks|bulls|mavericks|rockets/i.test(team)) return '🏀';
  return '⚽';
}

export function bentoCards(profile: TravelerProfile): BentoCard[] {
  const cards: BentoCard[] = [];
  const city = profile.hometown ? Object.keys(CITY_PALETTE).find((key) => profile.hometown!.toLowerCase().includes(key)) : undefined;
  const home = city ? CITY_PALETTE[city] : { emoji: '✦', palette: ['#334155', '#0F172A'] as [string, string] };
  cards.push({
    id: 'home', kind: 'home', size: 'xl', eyebrow: profile.hometown ? 'Home base' : 'You',
    title: profile.hometown ?? profile.name ?? 'Your board',
    body: profile.summary || undefined,
    items: [
      ...(profile.name && profile.hometown ? [{ label: profile.name, emoji: '👋' }] : []),
      ...(profile.age ? [{ label: `${profile.age}`, sub: 'years young', emoji: '✦' }] : []),
    ],
    emoji: home.emoji, palette: home.palette,
  });

  if (profile.family.length) {
    cards.push({
      id: 'crew', kind: 'crew', size: 'wide', eyebrow: 'The crew', title: profile.family.length === 1 ? 'Travels with 1' : `Travels with ${profile.family.length}`,
      items: profile.family.map((member) => ({
        label: member.name ?? member.label,
        emoji: member.relation === 'child' ? kidEmoji(member.label, member.age) : FAMILY_EMOJI[member.relation],
        sub: [member.name ? member.label : '', member.age !== undefined ? `${member.age}` : '', member.note ?? ''].filter(Boolean).join(' · ') || undefined,
      })),
      emoji: '🫶', palette: ['#F472B6', '#8B5CF6'],
    });
  }

  if (profile.teams.length) {
    const [first, ...rest] = profile.teams;
    cards.push({
      id: 'teams', kind: 'teams', size: rest.length ? 'wide' : 'sm', eyebrow: 'Ride or die', title: first,
      items: rest.map((team) => ({ label: team, emoji: teamEmoji(team) })),
      emoji: teamEmoji(first), palette: TEAM_COLORS[first] ?? ['#1F2937', '#9CA3AF'],
    });
  }

  if (profile.heritage.length) {
    const first = COUNTRY[profile.heritage[0]] ?? { flag: '🌍', palette: ['#0F766E', '#5EEAD4'] as [string, string] };
    cards.push({
      id: 'roots', kind: 'roots', size: 'sm', eyebrow: 'Roots', title: profile.heritage.join(' · '),
      emoji: first.flag, palette: first.palette,
    });
  }

  const listening = profile.listening;
  const genres = listening?.genres.length ? listening.genres.slice(0, 6) : profile.music;
  if (genres.length || listening?.topArtists.length) {
    const match = MUSIC_EMOJI.find(([pattern]) => pattern.test(genres[0] ?? ''));
    cards.push({
      id: 'sound', kind: 'sound', size: 'wide', eyebrow: listening ? 'On repeat · from Spotify' : 'On repeat',
      title: listening?.topArtists[0] ?? genres[0],
      body: listening?.topArtists.length ? listening.topArtists.slice(1, 5).join(' · ') : undefined,
      items: genres.slice(0, 6).map((genre) => ({ label: genre })),
      emoji: match?.[1] ?? '🎧', palette: match?.[2] ?? ['#6D28D9', '#DB2777'],
    });
  }

  if (listening) {
    const meters = [
      ...(listening.nightOwl !== undefined ? [{ label: 'After 10 pm', value: listening.nightOwl }] : []),
      ...(listening.earlyBird !== undefined ? [{ label: 'Before 9 am', value: listening.earlyBird }] : []),
      ...listening.eras.slice(0, 2).map((era) => ({ label: era.decade, value: era.share })),
    ];
    const insights = listeningInsights(listening);
    cards.push({
      id: 'vibe', kind: 'vibe', size: 'tall', eyebrow: 'Your vibe',
      title: listening.energy === 'high' ? 'Turn it up' : listening.energy === 'chill' ? 'Slow and warm' : 'A bit of everything',
      meters,
      items: insights.slice(0, 3).map((insight) => ({ label: insight.title, emoji: insight.emoji })),
      emoji: listening.energy === 'high' ? '⚡' : listening.energy === 'chill' ? '🕯️' : '🎛️',
      palette: ['#1DB954', '#0B3D2E'],
    });
  }

  if (profile.events.length) {
    cards.push({
      id: 'live', kind: 'live', size: 'tall', eyebrow: 'Live', title: profile.events[0],
      items: profile.events.slice(1).map((event) => ({ label: event, emoji: '🎟️' })),
      emoji: '🎟️', palette: ['#F97316', '#DB2777'], image: '/editorial/coachella-weekend-two.jpg',
    });
  }

  if (profile.favoriteTrips.length) {
    const image = profile.favoriteTrips.map((trip) => TRIP_IMAGE.find(([pattern]) => pattern.test(trip))?.[1]).find(Boolean);
    cards.push({
      id: 'trips', kind: 'trips', size: 'wide', eyebrow: 'Favorite trips', title: profile.favoriteTrips[0],
      items: profile.favoriteTrips.slice(1).map((trip) => ({ label: trip, emoji: '✈️' })),
      emoji: '✈️', palette: TRIP_PALETTES[0], image,
    });
  }

  if (profile.interests.length) {
    const match = profile.interests.map((interest) => INTEREST_IMAGE.find(([pattern]) => pattern.test(interest))).find(Boolean);
    cards.push({
      id: 'into', kind: 'into', size: profile.interests.length > 3 ? 'wide' : 'sm', eyebrow: 'Into', title: profile.interests[0],
      items: profile.interests.slice(1).map((interest) => ({ label: interest, emoji: INTEREST_IMAGE.find(([pattern]) => pattern.test(interest))?.[2] })),
      emoji: match?.[2] ?? '⭐', palette: TRIP_PALETTES[2], image: match?.[1] || undefined,
    });
  }

  if (profile.food.length) {
    cards.push({
      id: 'food', kind: 'food', size: 'sm', eyebrow: 'Always ordering', title: profile.food[0],
      items: profile.food.slice(1).map((food) => ({ label: food })),
      emoji: /bbq|churrasco|steak/i.test(profile.food[0]) ? '🔥' : /sushi|ramen/i.test(profile.food[0]) ? '🍣' : '🍽️', palette: ['#EA580C', '#FACC15'],
    });
  }

  // A board looks broken when the same photo repeats, so later cards fall back to color.
  const used = new Set<string>();
  return cards.map((card) => {
    if (!card.image) return card;
    if (used.has(card.image)) return { ...card, image: undefined };
    used.add(card.image);
    return card;
  });
}

/** True when a profile has more than an empty home card to show. */
export function hasBoardContent(profile: TravelerProfile): boolean {
  return bentoCards(profile).length > 1 || Boolean(profile.hometown || profile.summary);
}

export const EXAMPLE_RAMBLE =
  "I'm a 44-year-old from Atlanta, Georgia. Huge Atlanta Braves fan. I love hip hop, house music and some classic rock, and we try to hit concerts and festivals like Music Midtown and Shaky Knees. I have two young sons, 8 and 12, and a wife. She's Brazilian, so samba and churrasco are big in our house. Our favorite trip was to Trancoso in Bahia, and we loved skiing in Park City. I'm into golf, good wine, BBQ, and sushi.";

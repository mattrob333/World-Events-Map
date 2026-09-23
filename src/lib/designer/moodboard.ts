import type { TravelerProfile } from './profile';

export type TileSize = 'hero' | 'wide' | 'tall' | 'square';

export type MoodTile = {
  id: string;
  kind: 'home' | 'age' | 'team' | 'heritage' | 'family' | 'music' | 'event' | 'trip' | 'interest' | 'food';
  label: string;
  sub?: string;
  emoji: string;
  palette: [string, string];
  /** Editorial mood imagery (not a photo of the traveler or the exact place). */
  image?: string;
  size: TileSize;
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

/** Turns a profile into collage tiles, biggest and most personal first. */
export function moodboardTiles(profile: TravelerProfile): MoodTile[] {
  const tiles: MoodTile[] = [];
  if (profile.hometown) {
    const city = Object.keys(CITY_PALETTE).find((key) => profile.hometown!.toLowerCase().includes(key));
    const style = city ? CITY_PALETTE[city] : { emoji: '📍', palette: ['#334155', '#64748B'] as [string, string] };
    tiles.push({ id: 'home', kind: 'home', label: profile.hometown, sub: 'Home base', size: 'hero', ...style });
  }
  if (profile.age) tiles.push({ id: 'age', kind: 'age', label: String(profile.age), sub: profile.name ?? 'Years young', emoji: '✦', palette: ['#FDE68A', '#F59E0B'], size: 'square' });
  profile.teams.forEach((team, i) =>
    tiles.push({ id: `team-${i}`, kind: 'team', label: team, sub: 'Ride or die', emoji: /braves|yankees|red sox|cubs|dodgers|mets|astros/i.test(team) ? '⚾' : /falcons|cowboys|chiefs|bulldogs|eagles|49ers/i.test(team) ? '🏈' : /hawks|lakers|heat|warriors|celtics|knicks|bulls/i.test(team) ? '🏀' : '⚽', palette: TEAM_COLORS[team] ?? ['#1F2937', '#9CA3AF'], size: i === 0 ? 'tall' : 'square' }),
  );
  for (const [i, member] of profile.family.entries()) {
    const sub = [member.age !== undefined ? `${member.age}` : '', member.note ?? ''].filter(Boolean).join(' · ');
    tiles.push({
      id: `family-${i}`, kind: 'family', label: member.name ?? member.label, sub: member.name ? [member.label, sub].filter(Boolean).join(' · ') : sub || undefined,
      emoji: member.relation === 'child' ? kidEmoji(member.label, member.age) : FAMILY_EMOJI[member.relation],
      palette: member.relation === 'partner' ? ['#F472B6', '#FB7185'] : member.relation === 'child' ? (i % 2 ? ['#38BDF8', '#818CF8'] : ['#34D399', '#22D3EE']) : ['#A78BFA', '#C4B5FD'],
      size: 'square',
    });
  }
  for (const country of profile.heritage) {
    const style = COUNTRY[country] ?? { flag: '🌍', palette: ['#0F766E', '#5EEAD4'] as [string, string] };
    tiles.push({ id: `heritage-${country}`, kind: 'heritage', label: country, sub: 'Roots', emoji: style.flag, palette: style.palette, size: 'wide' });
  }
  profile.music.forEach((genre, i) => {
    const match = MUSIC_EMOJI.find(([pattern]) => pattern.test(genre));
    tiles.push({ id: `music-${i}`, kind: 'music', label: genre, sub: 'On repeat', emoji: match?.[1] ?? '🎶', palette: match?.[2] ?? ['#6D28D9', '#DB2777'], size: i === 0 ? 'wide' : 'square' });
  });
  profile.events.forEach((event, i) =>
    tiles.push({ id: `event-${i}`, kind: 'event', label: event, sub: 'Been there, danced there', emoji: '🎟️', palette: ['#F97316', '#DB2777'], image: i === 0 ? '/editorial/coachella-weekend-two.jpg' : undefined, size: i === 0 ? 'tall' : 'square' }),
  );
  profile.favoriteTrips.forEach((trip, i) => {
    const image = TRIP_IMAGE.find(([pattern]) => pattern.test(trip))?.[1];
    tiles.push({ id: `trip-${i}`, kind: 'trip', label: trip, sub: 'Favorite trip', emoji: '✈️', palette: TRIP_PALETTES[i % TRIP_PALETTES.length], image, size: image ? 'wide' : 'square' });
  });
  profile.interests.forEach((interest, i) => {
    const match = INTEREST_IMAGE.find(([pattern]) => pattern.test(interest));
    const image = match?.[1] || undefined;
    tiles.push({ id: `interest-${i}`, kind: 'interest', label: interest, emoji: match?.[2] ?? '⭐', palette: TRIP_PALETTES[(i + 2) % TRIP_PALETTES.length], image, size: image ? 'tall' : 'square' });
  });
  profile.food.forEach((food, i) =>
    tiles.push({ id: `food-${i}`, kind: 'food', label: food, sub: 'Always ordering', emoji: /bbq|churrasco|steak/i.test(food) ? '🔥' : /sushi|ramen/i.test(food) ? '🍣' : /pizza/i.test(food) ? '🍕' : '🍽️', palette: ['#EA580C', '#FACC15'], size: 'square' }),
  );
  // A collage looks broken when the same photo repeats, so later tiles fall back to color.
  const used = new Set<string>();
  return tiles.map((tile) => {
    if (!tile.image) return tile;
    if (used.has(tile.image)) return { ...tile, image: undefined, size: tile.size === 'tall' ? 'square' : tile.size };
    used.add(tile.image);
    return tile;
  });
}

export const EXAMPLE_RAMBLE =
  "I'm a 44-year-old from Atlanta, Georgia. Huge Atlanta Braves fan. I love hip hop, house music and some classic rock, and we try to hit concerts and festivals like Music Midtown and Shaky Knees. I have two young sons, 8 and 12, and a wife. She's Brazilian, so samba and churrasco are big in our house. Our favorite trip was to Trancoso in Bahia, and we loved skiing in Park City. I'm into golf, good wine, BBQ, and sushi.";

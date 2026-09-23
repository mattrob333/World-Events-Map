import { listeningTags, normalizeListening, type ListeningProfile } from './listening';

/**
 * Traveler profile built from a spoken or typed "ramble". The same shape is
 * produced by the Claude parser (server) and the on-device parser below, so
 * the mood board never needs to know which one ran.
 */

export type Relation = 'partner' | 'child' | 'parent' | 'sibling' | 'friend' | 'other';

export type FamilyMember = {
  relation: Relation;
  /** Word the traveler used: "wife", "son", "daughter"… */
  label: string;
  name?: string;
  age?: number;
  note?: string;
};

export type TravelerProfile = {
  name?: string;
  age?: number;
  hometown?: string;
  heritage: string[];
  teams: string[];
  music: string[];
  /** Concerts, festivals, live events they love. */
  events: string[];
  family: FamilyMember[];
  favoriteTrips: string[];
  interests: string[];
  food: string[];
  /** One sentence, in the traveler's own spirit. */
  summary: string;
  /** Imported from Spotify on this device; never produced by the AI parser. */
  listening?: ListeningProfile;
};

export type ParseEngine = 'claude' | 'on-device';

export type ParsedProfile = { profile: TravelerProfile; engine: ParseEngine };

export const MAX_RAMBLE_CHARS = 6000;

export function emptyProfile(): TravelerProfile {
  return { heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '' };
}

// --- dictionaries -----------------------------------------------------------

const TEAMS: Record<string, string> = {
  braves: 'Atlanta Braves', falcons: 'Atlanta Falcons', hawks: 'Atlanta Hawks', 'atlanta united': 'Atlanta United',
  'dream': 'Atlanta Dream', yankees: 'New York Yankees', mets: 'New York Mets', knicks: 'New York Knicks',
  giants: 'New York Giants', jets: 'New York Jets', 'red sox': 'Boston Red Sox', celtics: 'Boston Celtics',
  patriots: 'New England Patriots', dodgers: 'Los Angeles Dodgers', lakers: 'Los Angeles Lakers',
  cubs: 'Chicago Cubs', bulls: 'Chicago Bulls', bears: 'Chicago Bears', cowboys: 'Dallas Cowboys',
  mavericks: 'Dallas Mavericks', astros: 'Houston Astros', rockets: 'Houston Rockets', heat: 'Miami Heat',
  dolphins: 'Miami Dolphins', warriors: 'Golden State Warriors', '49ers': 'San Francisco 49ers',
  eagles: 'Philadelphia Eagles', steelers: 'Pittsburgh Steelers', packers: 'Green Bay Packers',
  chiefs: 'Kansas City Chiefs', saints: 'New Orleans Saints', titans: 'Tennessee Titans',
  'bulldogs': 'Georgia Bulldogs', 'crimson tide': 'Alabama Crimson Tide', 'yellow jackets': 'Georgia Tech Yellow Jackets',
  flamengo: 'Flamengo', corinthians: 'Corinthians', palmeiras: 'Palmeiras', 'são paulo fc': 'São Paulo FC',
  arsenal: 'Arsenal', liverpool: 'Liverpool', 'manchester united': 'Manchester United', 'man united': 'Manchester United',
  chelsea: 'Chelsea', barcelona: 'FC Barcelona', 'real madrid': 'Real Madrid',
};

const MUSIC = [
  'hip hop', 'hip-hop', 'rap', 'trap', 'country', 'jazz', 'house', 'deep house', 'techno', 'edm', 'rock', 'classic rock',
  'indie', 'r&b', 'rnb', 'soul', 'funk', 'reggae', 'bossa nova', 'samba', 'mpb', 'pop', 'classical', 'metal',
  'afrobeats', 'reggaeton', 'bluegrass', 'gospel', 'blues', 'disco', 'yacht rock', 'southern rock', 'grunge',
  'punk', 'folk', 'americana', 'latin', 'salsa', 'opera', 'motown', 'dance music', 'electronic',
];

const MUSIC_LABEL: Record<string, string> = {
  'hip-hop': 'Hip hop', rnb: 'R&B', 'r&b': 'R&B', edm: 'EDM', mpb: 'MPB',
};

const FESTIVALS = [
  'coachella', 'bonnaroo', 'lollapalooza', 'tomorrowland', 'glastonbury', 'jazz fest', 'jazzfest', 'acl',
  'austin city limits', 'burning man', 'ultra', 'music midtown', 'shaky knees', 'carnival', 'carnaval', 'rock in rio',
  'newport jazz', 'stagecoach', 'ez', 'edc', 'outside lands', 'governors ball', 'art basel', 'super bowl',
  'the masters', 'masters', 'kentucky derby', 'world cup', 'f1', 'formula 1', 'monaco grand prix', 'wimbledon',
];

const FESTIVAL_LABEL: Record<string, string> = {
  acl: 'Austin City Limits', jazzfest: 'Jazz Fest', edc: 'EDC', f1: 'Formula 1', 'the masters': 'The Masters',
  masters: 'The Masters', ez: '',
};

const INTERESTS: Record<string, string> = {
  ski: 'Skiing', skiing: 'Skiing', snowboard: 'Snowboarding', snowboarding: 'Snowboarding', golf: 'Golf',
  beach: 'Beaches', beaches: 'Beaches', snorkel: 'Snorkeling', snorkeling: 'Snorkeling', scuba: 'Diving', diving: 'Diving',
  surf: 'Surfing', surfing: 'Surfing', hiking: 'Hiking', hike: 'Hiking', fishing: 'Fishing', sailing: 'Sailing',
  boating: 'Boating', tennis: 'Tennis', pickleball: 'Pickleball', museums: 'Museums', art: 'Art', architecture: 'Architecture',
  nightlife: 'Nightlife', clubs: 'Nightlife', cocktails: 'Cocktails', wine: 'Wine', whiskey: 'Whiskey', bourbon: 'Bourbon',
  spa: 'Spa', yoga: 'Yoga', running: 'Running', cycling: 'Cycling', photography: 'Photography', cars: 'Cars',
  shopping: 'Shopping', history: 'History', camping: 'Camping', 'live music': 'Live music', concerts: 'Concerts',
  festivals: 'Festivals', sports: 'Sports', basketball: 'Basketball', baseball: 'Baseball', football: 'Football',
  soccer: 'Soccer', hunting: 'Hunting', adventure: 'Adventure',
};

const FOOD: Record<string, string> = {
  bbq: 'BBQ', barbecue: 'BBQ', sushi: 'Sushi', steak: 'Steakhouses', steakhouse: 'Steakhouses', pizza: 'Pizza',
  tacos: 'Tacos', seafood: 'Seafood', churrasco: 'Churrasco', churrascaria: 'Churrasco', 'fine dining': 'Fine dining',
  'southern food': 'Southern food', ramen: 'Ramen', italian: 'Italian', french: 'French', mexican: 'Mexican',
  'brazilian food': 'Brazilian food', fondue: 'Fondue', raclette: 'Raclette', coffee: 'Coffee', brunch: 'Brunch',
  oysters: 'Oysters', 'street food': 'Street food',
};

const NATIONALITIES: Record<string, string> = {
  brazilian: 'Brazil', mexican: 'Mexico', colombian: 'Colombia', argentinian: 'Argentina', argentine: 'Argentina',
  italian: 'Italy', french: 'France', german: 'Germany', swiss: 'Switzerland', spanish: 'Spain', portuguese: 'Portugal',
  irish: 'Ireland', british: 'United Kingdom', english: 'England', scottish: 'Scotland', nigerian: 'Nigeria',
  ghanaian: 'Ghana', jamaican: 'Jamaica', cuban: 'Cuba', 'puerto rican': 'Puerto Rico', dominican: 'Dominican Republic',
  korean: 'Korea', japanese: 'Japan', chinese: 'China', indian: 'India', greek: 'Greece', lebanese: 'Lebanon',
  canadian: 'Canada', australian: 'Australia', swedish: 'Sweden', dutch: 'Netherlands', polish: 'Poland',
  vietnamese: 'Vietnam', filipino: 'Philippines', haitian: 'Haiti', venezuelan: 'Venezuela', peruvian: 'Peru',
};

const RELATIONS: Record<string, { relation: Relation; label: string }> = {
  wife: { relation: 'partner', label: 'Wife' }, husband: { relation: 'partner', label: 'Husband' },
  partner: { relation: 'partner', label: 'Partner' }, girlfriend: { relation: 'partner', label: 'Girlfriend' },
  boyfriend: { relation: 'partner', label: 'Boyfriend' }, fiancee: { relation: 'partner', label: 'Fiancée' },
  fiancé: { relation: 'partner', label: 'Fiancé' }, fiance: { relation: 'partner', label: 'Fiancé' },
  son: { relation: 'child', label: 'Son' }, sons: { relation: 'child', label: 'Son' },
  daughter: { relation: 'child', label: 'Daughter' }, daughters: { relation: 'child', label: 'Daughter' },
  kid: { relation: 'child', label: 'Kid' }, kids: { relation: 'child', label: 'Kid' },
  boys: { relation: 'child', label: 'Son' }, girls: { relation: 'child', label: 'Daughter' },
  mom: { relation: 'parent', label: 'Mom' }, dad: { relation: 'parent', label: 'Dad' },
  mother: { relation: 'parent', label: 'Mom' }, father: { relation: 'parent', label: 'Dad' },
  brother: { relation: 'sibling', label: 'Brother' }, sister: { relation: 'sibling', label: 'Sister' },
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twin: 2, twins: 2,
};

const NUMBER_TEXT: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
};

// --- helpers ----------------------------------------------------------------

function titleCase(value: string): string {
  return value.replace(/\b([a-zà-ÿ])([a-zà-ÿ']*)/g, (_, a: string, b: string) => a.toUpperCase() + b);
}

function has(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text);
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toNumber(token: string): number | undefined {
  if (/^\d{1,3}$/.test(token)) return Number(token);
  return NUMBER_TEXT[token.toLowerCase()];
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

// --- on-device parser -------------------------------------------------------

function parseAge(text: string): number | undefined {
  const match =
    text.match(/\b(?:i'?m|i am|i’m)\s+(?:a\s+)?(\d{2})\b/i) ??
    text.match(/\b(\d{2})[- ]years?[- ]old\s+(?:man|woman|guy|dad|mom|mother|father|person)\b/i) ??
    text.match(/\bi(?:'m| am|’m)\s+(?:a\s+)?(\d{2})[- ]years?[- ]old/i);
  const age = match ? Number(match[1]) : undefined;
  return age && age >= 13 && age <= 110 ? age : undefined;
}

function parseName(text: string): string | undefined {
  const match = text.match(/\b(?:my name is|i'?m called|call me|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  return match?.[1];
}

const PLACE = String.raw`(?:St\.\s)?[A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){0,3}`;

function parseHometown(text: string): string | undefined {
  const place = `(${PLACE}(?:,\\s*${PLACE})?)`;
  const match =
    text.match(new RegExp(`\\b(?:i'?m|i am|i’m)\\s+(?:originally\\s+)?from\\s+${place}`)) ??
    text.match(new RegExp(`\\b(?:live in|living in|based in|grew up in)\\s+${place}`)) ??
    text.match(new RegExp(`\\bfrom\\s+(${PLACE},\\s*${PLACE})`));
  return match?.[1]?.trim();
}

function parseFamily(text: string, profile: TravelerProfile) {
  const family: FamilyMember[] = [];
  const lower = text.toLowerCase();

  // "two young sons, 8 and 12" / "a daughter who's 5" / "my son Leo, 10"
  const groupPattern =
    /\b(a|an|one|two|three|four|five|six|twin|twins|my|our)?\s*(?:young|little|teenage|grown|adult|older|younger|\s)*\s*(sons|daughters|kids|boys|girls|son|daughter|kid)\b([^.;]{0,60})/gi;
  for (const match of text.matchAll(groupPattern)) {
    const countWord = (match[1] ?? '').toLowerCase();
    const word = match[2].toLowerCase();
    const rest = match[3] ?? '';
    const info = RELATIONS[word];
    if (!info) continue;
    const ages = [...rest.matchAll(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen)\b(?!\s*(?:years? (?:together|married)|%))/gi)]
      .map((m) => toNumber(m[1]))
      .filter((n): n is number => n !== undefined && n < 60);
    const plural = word.endsWith('s') || countWord === 'twins';
    const count = NUMBER_WORDS[countWord] ?? (plural ? Math.max(ages.length, 2) : 1);
    const nameMatch = rest.match(/^\s*,?\s*(?:named|called)?\s*([A-Z][a-z]+)\b/);
    for (let i = 0; i < Math.min(count, 8); i += 1) {
      family.push({
        relation: info.relation,
        label: info.label,
        age: ages[i],
        name: count === 1 ? nameMatch?.[1] : undefined,
      });
    }
  }

  for (const [word, info] of Object.entries(RELATIONS)) {
    if (info.relation === 'child') continue;
    if (!has(lower, word)) continue;
    if (family.some((member) => member.label === info.label)) continue;
    const nameMatch = text.match(new RegExp(`\\b${word}(?:'s name is|,| is| named| called)?\\s+([A-Z][a-z]+)\\b`, 'i'));
    const candidate = nameMatch?.[1];
    const name = candidate && !/^(Is|And|She|He|Who|The|A|An|From|Loves|Likes)$/.test(candidate) ? candidate : undefined;
    family.push({ relation: info.relation, label: info.label, name });
  }

  // "She's Brazilian" right after mentioning a partner → partner heritage.
  for (const [word, country] of Object.entries(NATIONALITIES)) {
    const pronoun = new RegExp(`\\b(she|he)(?:'s|’s| is)\\s+(?:\\w+\\s+)?${word}\\b`, 'i').exec(text);
    const self = new RegExp(`\\bi(?:'m|’m| am)\\s+(?:\\w+\\s+)?${word}\\b`, 'i').test(text);
    const partner = family.find((member) => member.relation === 'partner');
    if (pronoun && partner) {
      partner.note = titleCase(word);
      profile.heritage.push(country);
    } else if (self || new RegExp(`\\b${word}\\s+(?:heritage|roots|family|background)\\b`, 'i').test(text)) {
      profile.heritage.push(country);
    }
  }

  profile.family = family;
}

function parseTrips(text: string): string[] {
  const trips: string[] = [];
  for (const sentence of sentences(text)) {
    if (!/\b(trip|went|visited|vacation|holiday|honeymoon|loved|favorite|favourite|been to|traveled|travelled)\b/i.test(sentence)) continue;
    for (const match of sentence.matchAll(/\b(?:to|in|at|visited|around)\s+((?:[A-Z][\w'’.-]+)(?:\s+(?:[A-Z][\w'’.-]+|de|do|da|del|la|le))*)/g)) {
      const place = match[1].replace(/[.,]$/, '');
      if (/^(I|We|My|The|A|And|But|So|It|That|This)$/.test(place)) continue;
      trips.push(place);
    }
  }
  return uniq(trips).slice(0, 8);
}

/**
 * Deterministic parser used when the AI parser is not configured or fails.
 * It only records things the traveler actually said — no inference beyond
 * dictionary matches, so the board never shows invented facts.
 */
export function parseProfileLocally(raw: string): TravelerProfile {
  const text = raw.slice(0, MAX_RAMBLE_CHARS);
  const lower = text.toLowerCase();
  const profile = emptyProfile();

  profile.name = parseName(text);
  profile.age = parseAge(text);
  profile.hometown = parseHometown(text);

  profile.teams = uniq(Object.entries(TEAMS).filter(([key]) => has(lower, key)).map(([, team]) => team));
  const genres = MUSIC.filter((genre) => has(lower, genre));
  profile.music = uniq(
    genres
      .filter((genre) => !genres.some((other) => other !== genre && other.includes(genre)))
      .map((genre) => MUSIC_LABEL[genre] ?? titleCase(genre)),
  );
  profile.events = uniq(
    FESTIVALS.filter((name) => has(lower, name))
      .map((name) => (name in FESTIVAL_LABEL ? FESTIVAL_LABEL[name] : titleCase(name)))
      .filter(Boolean),
  );
  profile.interests = uniq(Object.entries(INTERESTS).filter(([key]) => has(lower, key)).map(([, label]) => label));
  profile.food = uniq(Object.entries(FOOD).filter(([key]) => has(lower, key)).map(([, label]) => label));
  if (/\bconcerts?\b/i.test(text) && !profile.interests.includes('Concerts')) profile.interests.push('Concerts');

  parseFamily(text, profile);
  profile.heritage = uniq(profile.heritage);
  profile.favoriteTrips = parseTrips(text);
  profile.summary = summarize(profile);
  return profile;
}

export function summarize(profile: TravelerProfile): string {
  const parts: string[] = [];
  const who = [profile.age ? `${profile.age}` : '', profile.hometown ? `from ${profile.hometown}` : ''].filter(Boolean).join(', ');
  if (who) parts.push(who);
  const kids = profile.family.filter((m) => m.relation === 'child');
  const partner = profile.family.find((m) => m.relation === 'partner');
  if (partner || kids.length) {
    const bits = [partner ? partner.label.toLowerCase() : '', kids.length ? `${kids.length} ${kids.length === 1 ? 'kid' : 'kids'}` : ''].filter(Boolean);
    parts.push(`travels with ${bits.join(' and ')}`);
  }
  const loves = [...profile.teams.slice(0, 1), ...profile.music.slice(0, 2), ...profile.interests.slice(0, 2)];
  if (loves.length) parts.push(`into ${loves.join(', ')}`);
  const artists = profile.listening?.topArtists.slice(0, 2) ?? [];
  if (artists.length) parts.push(`has ${artists.join(' and ')} on repeat`);
  return parts.length ? `${parts.join(' · ')}.` : '';
}

/** Coerces untrusted JSON (AI output, device storage) into a safe profile. */
export function normalizeProfile(input: unknown): TravelerProfile {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (value: unknown, max = 80) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);
  const list = (value: unknown, max = 12) =>
    uniq((Array.isArray(value) ? value : []).map((item) => str(item)).filter((item): item is string => Boolean(item))).slice(0, max);
  const num = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? Math.round(value) : undefined;
  const relations: Relation[] = ['partner', 'child', 'parent', 'sibling', 'friend', 'other'];
  const family = (Array.isArray(source.family) ? source.family : []).slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const member = item as Record<string, unknown>;
    const relation = relations.includes(member.relation as Relation) ? (member.relation as Relation) : 'other';
    return [{
      relation,
      label: str(member.label, 30) ?? titleCase(relation),
      name: str(member.name, 40),
      age: num(member.age, 0, 110),
      note: str(member.note, 60),
    }];
  });
  return {
    name: str(source.name, 40),
    age: num(source.age, 13, 110),
    hometown: str(source.hometown),
    heritage: list(source.heritage, 6),
    teams: list(source.teams, 8),
    music: list(source.music, 10),
    events: list(source.events, 10),
    family,
    favoriteTrips: list(source.favoriteTrips, 8),
    interests: list(source.interests, 14),
    food: list(source.food, 8),
    summary: str(source.summary, 240) ?? '',
    listening: normalizeListening(source.listening),
  };
}

/** Trip-planning signals derived from a profile, used by the itinerary composer. */
export function profileTags(profile: TravelerProfile): string[] {
  const tags = new Set<string>();
  const kids = profile.family.filter((member) => member.relation === 'child');
  if (kids.length) tags.add('kids');
  if (kids.some((kid) => (kid.age ?? 10) <= 9)) tags.add('little-kids');
  if (kids.some((kid) => (kid.age ?? 10) >= 10)) tags.add('big-kids');
  const text = [...profile.interests, ...profile.music, ...profile.events, ...profile.food, ...profile.teams, ...profile.heritage]
    .join(' ')
    .toLowerCase();
  const map: [RegExp, string][] = [
    [/ski|snowboard/, 'ski'], [/beach|snorkel|diving|surf|boat|sailing/, 'water'], [/nightlife|cocktail|club/, 'nightlife'],
    [/concert|festival|live music|house|techno|edm|hip hop|rap|r&b|jazz|samba|bossa/, 'music'],
    [/wine|fine dining|steak|sushi|oyster|french|italian/, 'food'], [/bbq|churrasco|southern/, 'hearty'],
    [/spa|yoga|wellness/, 'wellness'], [/sports|baseball|football|basketball|soccer|braves|falcons|hawks/, 'sports'],
    [/brazil/, 'brazil'], [/art|museum|architecture|history/, 'culture'], [/hiking|adventure|cycling|running/, 'active'],
    [/photography/, 'views'], [/shopping/, 'shopping'],
  ];
  for (const [pattern, tag] of map) if (pattern.test(text)) tags.add(tag);
  if (profile.listening) for (const tag of listeningTags(profile.listening)) tags.add(tag);
  return [...tags];
}

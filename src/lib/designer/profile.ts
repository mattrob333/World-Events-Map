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
  /** The count came from a bare plural ("the kids"), not a number the traveler said. */
  guessed?: boolean;
};

export type TravelStyle = {
  budget?: 'shoestring' | 'comfortable' | 'premium' | 'no-limit';
  pace?: 'slow' | 'balanced' | 'packed';
  /** How much they want to meet people on the road. */
  social?: 'recharge-solo' | 'small-crew' | 'meet-everyone';
  /** e.g. "social hostel with a bar", "boutique hotel", "villa with the crew". */
  lodging: string[];
  homeAirport?: string;
  dietary: string[];
  /** Hard no's: "cruises", "tour buses", "long layovers". */
  avoid: string[];
  bucketList: string[];
  languages: string[];
  /** Anything else in their own words. */
  notes?: string;
};

export const BUDGETS = ['shoestring', 'comfortable', 'premium', 'no-limit'] as const;
export const PACES = ['slow', 'balanced', 'packed'] as const;
export const SOCIAL_LEVELS = ['recharge-solo', 'small-crew', 'meet-everyone'] as const;

export type TravelerProfile = {
  name?: string;
  age?: number;
  hometown?: string;
  heritage: string[];
  teams: string[];
  music: string[];
  /** Artists and bands they named. Optional so older saved boards still load. */
  artists?: string[];
  /** Concerts, festivals, live events they love. */
  events: string[];
  family: FamilyMember[];
  favoriteTrips: string[];
  interests: string[];
  food: string[];
  /** One sentence, in the traveler's own spirit. */
  summary: string;
  /** Their best moments on trips, in their own words: the stories they still tell. */
  bestMoments?: string[];
  /** Imported from Spotify on this device; never produced by the AI parser. */
  listening?: ListeningProfile;
  /** How they like to travel. Filled by the traveler or their own AI agent. */
  style?: TravelStyle;
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

/** "I'm", "Im", "I’m", "I am", in any case the traveler typed it. */
const I_AM = String.raw`(?:[Ii]['’]?[Mm]|[Ii]\s+[Aa][Mm])\b`;
const CAP_WORD = String.raw`[A-Z][a-zà-ÿ'’-]+`;

/** Capitalized words after "I'm" that are not names. */
const NOT_NAMES = new Set([
  'from', 'originally', 'here', 'in', 'on', 'at', 'so', 'just', 'really', 'pretty', 'very', 'not', 'into', 'also', 'big', 'huge',
  'a', 'an', 'the', 'married', 'single', 'retired', 'based', 'living', 'currently', 'still', 'always', 'obsessed', 'totally', 'going',
  'looking', 'planning', 'trying', 'thinking', 'sure', 'ready', 'done', 'new', 'old', 'back', 'getting', 'hoping', 'dying', 'down', 'up',
  'mostly', 'basically', 'honestly', 'definitely', 'probably', 'actually', 'kind', 'sort', 'half', 'part', 'fully', 'good', 'fine',
]);

function isName(word: string | undefined): word is string {
  if (!word) return false;
  const lower = word.toLowerCase();
  return !NOT_NAMES.has(lower) && !NATIONALITIES[lower] && !TEAMS[lower] && !MUSIC.includes(lower) && !INTERESTS[lower] && !FOOD[lower];
}

function parseAge(text: string): number | undefined {
  const match =
    text.match(new RegExp(String.raw`\b${I_AM}\s+(?:a\s+)?(\d{2})\b(?!\s*(?:%|kids|years? (?:together|married)))`)) ??
    // "I'm Matt, 44"
    text.match(new RegExp(String.raw`\b${I_AM}\s+${CAP_WORD},\s*(\d{2})\b(?!\s*%)`)) ??
    text.match(/\b(\d{2})[- ]years?[- ]old\s+(?:man|woman|guy|dad|mom|mother|father|person)\b/i) ??
    text.match(new RegExp(String.raw`\b${I_AM}\s+(?:a\s+)?(\d{2})[- ]years?[- ]old`));
  const age = match ? Number(match[1]) : undefined;
  return age && age >= 13 && age <= 110 ? age : undefined;
}

function parseName(text: string): string | undefined {
  const called = text.match(new RegExp(String.raw`\b(?:[Mm]y name is|${I_AM}\s+called|[Cc]all me|[Tt]his is)\s+(${CAP_WORD}(?:\s+${CAP_WORD})?)`));
  if (called && isName(called[1].split(/\s+/)[0])) return called[1];
  // "I'm Matt, 44" / "I'm Matt from Atlanta" / "Hi, I'm Matt." — a capitalized word right after "I'm" that isn't a nationality or filler.
  const intro = text.match(new RegExp(String.raw`\b${I_AM}\s+(${CAP_WORD})(?=\s*(?:,|\.|!|;|—|-|\s+(?:and|from|here)\b|$))`));
  return isName(intro?.[1]) ? intro[1] : undefined;
}

const PLACE = String.raw`(?:St\.\s)?[A-Z][\w'’-]*(?:\s+[A-Z][\w'’-]*){0,3}`;

const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii',
  'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming', 'ontario', 'quebec',
  'british columbia', 'bahia', 'minas gerais', 'rio de janeiro', 'são paulo', 'sao paulo',
];
const COUNTRIES = new Set([
  ...Object.values(NATIONALITIES).map((c) => c.toLowerCase()), 'usa', 'us', 'uk', 'united states', 'brasil', 'the netherlands',
  'new zealand', 'south africa', 'costa rica', 'belgium', 'austria', 'denmark', 'norway', 'finland', 'iceland', 'israel', 'turkey',
]);

/** "Georgia", "GA", "Portugal": accepted as the part after a city's comma. */
function isRegion(value: string): boolean {
  const lower = value.toLowerCase();
  return /^[A-Z]{2}$/.test(value) || US_STATES.includes(lower) || COUNTRIES.has(lower);
}

function parseHometown(text: string): string | undefined {
  const place = String.raw`(${PLACE})(?:,\s*(${PLACE}))?`;
  // Up to four short tokens between "I'm" and "from": a name, an age, "originally", "a 44-year-old man".
  const filler = String.raw`(?:\s+(?:originally|a|an|\d{2}(?:[- ]years?[- ]old)?,?|(?:man|woman|guy|dad|mom|mother|father),?|${CAP_WORD},?)){0,4}`;
  const patterns = [
    new RegExp(String.raw`\b${I_AM}${filler}\s+[Ff]rom\s+${place}`),
    new RegExp(String.raw`\b[Ww]e(?:['’]re|\s+are)\s+(?:originally\s+)?from\s+${place}`),
    new RegExp(String.raw`(?:^|[.!?]\s+)(?:[Oo]riginally\s+)?[Ff]rom\s+${place}`),
    new RegExp(String.raw`\b(?:[Ll]ive in|[Ll]iving in|[Bb]ased in|[Gg]rew up in|[Hh]ometown is)\s+${place}`),
    new RegExp(String.raw`\bfrom\s+(${PLACE}),\s*(${PLACE})`),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const city = match?.[1]?.trim();
    if (!city || /^(The|My|Our|A|An|I|We|It|Here|There)$/.test(city)) continue;
    const region = match?.[2]?.trim();
    return region && isRegion(region) ? `${city}, ${region}` : city;
  }
  return undefined;
}

// --- artists ---------------------------------------------------------------

/** Well-known artists matched case-sensitively, so "future" or "journey" in a sentence never counts. */
const KNOWN_ARTISTS = [
  'Foo Fighters', 'Pearl Jam', 'Tom Petty', 'Taylor Swift', 'Beyoncé', 'Beyonce', 'Kendrick Lamar', 'Bad Bunny', 'Metallica',
  'Radiohead', 'Coldplay', 'U2', 'The Rolling Stones', 'Rolling Stones', 'The Beatles', 'Led Zeppelin', 'Pink Floyd',
  'Bruce Springsteen', 'Bob Dylan', 'Bob Marley', 'Zac Brown Band', 'Luke Combs', 'Morgan Wallen', 'Chris Stapleton',
  'Dave Matthews Band', 'Phish', 'Grateful Dead', 'Dead & Company', 'Billy Joel', 'Elton John', 'Fleetwood Mac', 'Outkast',
  'OutKast', 'Ludacris', 'Travis Scott', 'Kanye West', 'Jay-Z', 'Eminem', 'Post Malone', 'Harry Styles', 'Ed Sheeran', 'Adele',
  'Bruno Mars', 'Dua Lipa', 'Billie Eilish', 'SZA', 'The Weeknd', 'Rihanna', 'Lady Gaga', 'Madonna', 'Michael Jackson',
  'Stevie Wonder', 'Red Hot Chili Peppers', 'Nirvana', 'Green Day', 'Blink-182', 'The Killers', 'Arctic Monkeys', 'Kings of Leon',
  'The Black Keys', 'Tame Impala', 'Daft Punk', 'Calvin Harris', 'David Guetta', 'Anitta', 'Caetano Veloso', 'Gilberto Gil',
  'Jorge Ben Jor', 'Seu Jorge', 'Karol G', 'J Balvin', 'Shakira', 'Burna Boy', 'Wizkid', 'BTS', 'Dolly Parton', 'Johnny Cash',
  'Willie Nelson', 'George Strait', 'Kenny Chesney', 'Jimmy Buffett', 'Widespread Panic', 'Allman Brothers', 'Lynyrd Skynyrd',
  'AC/DC', 'Bon Jovi', 'Oasis', 'Miles Davis', 'John Coltrane', 'Norah Jones', 'Zach Bryan', 'Noah Kahan', 'Olivia Rodrigo',
  'Sabrina Carpenter', 'Chappell Roan', 'Kacey Musgraves', 'Jason Isbell', 'Tyler Childers', 'Hozier', 'Mumford & Sons',
  'The Lumineers', 'Vampire Weekend', 'LCD Soundsystem', 'Gorillaz', 'Beastie Boys', 'Wu-Tang Clan', 'Lauryn Hill', 'Erykah Badu',
  'Frank Ocean', 'Doja Cat', 'Snoop Dogg', 'Dr. Dre', 'Tupac', 'The Strokes', 'John Mayer', 'Jack Johnson', 'Sublime', 'Khruangbin',
];

const ARTIST_ALIAS: Record<string, string> = { Beyonce: 'Beyoncé', 'Rolling Stones': 'The Rolling Stones', OutKast: 'Outkast' };

const MUSIC_CUE = /\b(music|bands?|artists?|singers?|listen(?:ing)?|playlists?|concerts?|gigs?|shows?|tour|rock|jazz|hip[- ]hop|rap|country|pop|house|techno|edm|r&b|soul|funk|metal|punk|indie|folk|blues|reggae|samba|grunge)\b/i;
const TRAVEL_CUE = /\b(trips?|visit(?:ed)?|went to|been to|towns?|city|cities|beach(?:es)?|vacation|holiday|live in|lived in)\b/i;
const LEAD_IN = /^(?:(?:and|but|plus|also|honestly|really)\s+)*(?:(?:i|we)(?:['’]m| am| are|['’]re)?\s+)?(?:(?:really|also|just|totally)\s+)?(?:(?:my|our)\s+)?(?:love|loved|like|dig|adore|listen to|into|big fan of|huge fan of|fan of|obsessed with|favorites? (?:are|is)|favorite (?:bands?|artists?|singers?) (?:are|is))\s+/i;
const STRONG_CUE = /\b(?:fan of|listen(?:ing)? to|obsessed with|favorite (?:bands?|artists?|singers?|groups?) (?:are|is))\s*$/i;
const NAME_SEGMENT = /^(?:[A-Z0-9][\w'’.!$&/-]*)(?:\s+(?:[A-Z0-9][\w'’.!$&/-]*|of|the|and|de|da|do|y|n['’]))*$/;
const NOT_ARTIST_FIRST = /^(I|I['’]m|We|We['’]re|She|She['’]s|He|He['’]s|They|My|Our|It|That|This|So|And|But|Honestly|Also|Plus|The|A|An)$/;

function notArtist(value: string, profile: TravelerProfile): boolean {
  const lower = value.toLowerCase();
  const first = value.split(/\s+/)[0];
  if (value.length > 40 || value.split(/\s+/).length > 5) return true;
  if (NOT_ARTIST_FIRST.test(value) || (NOT_ARTIST_FIRST.test(first) && value.split(/\s+/).length === 1)) return true;
  if (/^(She|He|We|I|They|It)['’]/.test(first)) return true;
  if (TEAMS[lower] || Object.values(TEAMS).some((team) => team.toLowerCase() === lower)) return true;
  if (FESTIVALS.includes(lower) || MUSIC.includes(lower) || NATIONALITIES[lower] || INTERESTS[lower] || FOOD[lower]) return true;
  if (COUNTRIES.has(lower) || US_STATES.includes(lower)) return true;
  const known = [profile.name, profile.hometown?.split(',')[0], ...profile.family.map((m) => m.name)].filter(Boolean).map((v) => v!.toLowerCase());
  return known.includes(lower);
}

function parseArtists(text: string, profile: TravelerProfile): string[] {
  const found: string[] = [];
  for (const artist of KNOWN_ARTISTS) {
    const escaped = artist.replace(/[.*+?^${}()|[\]\\&/]/g, '\\$&');
    if (new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`).test(text)) found.push(ARTIST_ALIAS[artist] ?? artist);
  }
  for (const sentence of sentences(text)) {
    if (!MUSIC_CUE.test(sentence) || TRAVEL_CUE.test(sentence)) continue;
    const segments = sentence.replace(/[.!?]+$/, '').split(/\s*[,;]\s*|\s+(?:and|&|plus)\s+/);
    let run: string[] = [];
    let before = '';
    const flush = () => {
      // A list that follows "in", "at" or "to" is places, not artists.
      if (run.length >= 2 && !/\b(in|at|to|around|near|from|like)\s+(?:[A-Z][\w'’-]*\s*)*$|\b(in|at|to|around|near|from|like)\s*$/.test(before)) found.push(...run);
      run = [];
    };
    for (const raw of segments) {
      const segment = raw.trim();
      if (!segment) continue;
      const stripped = segment.replace(LEAD_IN, '');
      const cue = segment.slice(0, segment.length - stripped.length);
      if (NAME_SEGMENT.test(stripped) && !notArtist(stripped, profile)) {
        // A run opened by "I love…" / "listen to…" is introduced as music, whatever came before.
        if (!run.length && cue) before = '';
        run.push(stripped);
        if (STRONG_CUE.test(cue)) found.push(stripped);
        continue;
      }
      flush();
      before = segment;
    }
    flush();
  }
  return uniq(found).slice(0, 10);
}

// --- family ------------------------------------------------------------------

const AGE_TOKEN = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen)\b(?!\s*(?:years? (?:together|married)|%))/gi;

function parseFamily(text: string, profile: TravelerProfile) {
  const family: FamilyMember[] = [];
  const lower = text.toLowerCase();

  // "two young sons, 8 and 12" / "a daughter who's 5" / "my son Leo, 10" / "Two boys, Jack is 12 and Sam is 8"
  const groupPattern =
    /\b(a|an|one|two|three|four|five|six|twin|twins|my|our)?\s*(?:young|little|teenage|grown|adult|older|younger|\s)*\s*(sons|daughters|kids|boys|girls|children|son|daughter|kid|child)\b(?=([^.;!?]{0,60}))/gi;
  for (const match of text.matchAll(groupPattern)) {
    const countWord = (match[1] ?? '').toLowerCase();
    const word = match[2].toLowerCase();
    const info = RELATIONS[word] ?? (word.startsWith('child') ? RELATIONS.kid : undefined);
    if (!info) continue;
    // Only the words about these kids: stop at the next person ("and my wife Kelly", "a daughter").
    const rest = (match[3] ?? '').split(/\b(?:wife|husband|partner|girlfriend|boyfriend|fianc\S*|mom|dad|mother|father|brother|sister|sons?|daughters?|kids?|boys|girls|child(?:ren)?|I|I['’]m|we)\b/)[0];
    const ages = [...rest.matchAll(AGE_TOKEN)].map((m) => toNumber(m[1])).filter((n): n is number => n !== undefined && n < 60);
    // "Jack is 12 and Sam is 8" / "Jack, 12" → names that line up with ages.
    const pairs = [...rest.matchAll(/\b([A-Z][a-z]+)(?:,|\s+is|\s+who['’]s|['’]s|\s*\()?\s+(\d{1,2})\b/g)].filter((m) => isName(m[1]));
    const names = pairs.length === ages.length ? pairs.map((m) => m[1]) : [];
    const plural = word.endsWith('s') || word === 'children' || countWord === 'twins';
    const singleName = rest.match(/^\s*,?\s*(?:named|called)?\s*([A-Z][a-z]+)\b/)?.[1];
    const explicit = NUMBER_WORDS[countWord];
    const kids = family.filter((member) => member.relation === 'child');

    if (explicit === undefined && kids.length) {
      // "the kids", "my son", "the boys are 8 and 12": a reference to kids already counted.
      const open = kids.filter((kid) => kid.age === undefined);
      ages.forEach((age, i) => {
        const kid = open[i];
        if (kid) {
          kid.age = age;
          kid.name ??= names[i];
          kid.guessed = undefined;
        } else {
          family.push({ relation: 'child', label: info.label, age, name: names[i] });
        }
      });
      if (!plural && singleName && isName(singleName) && !kids.some((kid) => kid.name === singleName)) {
        const target = kids.find((kid) => !kid.name && (kid.label === info.label || kid.label === 'Kid'));
        if (target) {
          target.name = singleName;
          if (target.label === 'Kid') target.label = info.label;
        }
      }
      continue;
    }

    const count = explicit ?? (ages.length || (plural ? 2 : 1));
    const guessed = explicit === undefined && !ages.length && plural;
    for (let i = 0; i < Math.min(count, 8); i += 1) {
      family.push({
        relation: info.relation,
        label: info.label,
        age: ages[i],
        name: count === 1 ? (isName(singleName) ? singleName : undefined) : names[i],
        ...(guessed ? { guessed: true } : {}),
      });
    }
  }

  for (const [word, info] of Object.entries(RELATIONS)) {
    if (info.relation === 'child') continue;
    if (!has(lower, word)) continue;
    if (family.some((member) => member.label === info.label)) continue;
    const nameMatch = text.match(new RegExp(`\\b${word}(?:'s name is|,| is| named| called)?\\s+([A-Z][a-z]+)\\b`, 'i'));
    const candidate = nameMatch?.[1];
    // "my wife is Brazilian" names a nationality, not a person.
    const nationality = candidate && NATIONALITIES[candidate.toLowerCase()] ? candidate : undefined;
    const name = candidate && !nationality && !/^(Is|And|She|He|Who|The|A|An|From|Loves|Likes)$/.test(candidate) ? candidate : undefined;
    if (nationality) profile.heritage.push(NATIONALITIES[nationality.toLowerCase()]);
    family.push({ relation: info.relation, label: info.label, name, note: nationality });
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
  const artists = parseArtists(text, profile).filter((artist) => !profile.favoriteTrips.includes(artist));
  if (artists.length) profile.artists = artists;
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
  const artists = profileArtists(profile).slice(0, 2);
  if (artists.length) parts.push(`has ${artists.join(' and ')} on repeat`);
  return parts.length ? `${parts.join(' · ')}.` : '';
}

/** Every artist we know they love: Spotify's top artists first, then the ones they named. */
export function profileArtists(profile: Pick<TravelerProfile, 'artists' | 'listening'>): string[] {
  return uniq([...(profile.listening?.topArtists ?? []), ...(profile.artists ?? [])]).slice(0, 10);
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
      ...(member.guessed === true ? { guessed: true } : {}),
    }];
  });
  return {
    name: str(source.name, 40),
    age: num(source.age, 13, 110),
    hometown: str(source.hometown),
    heritage: list(source.heritage, 6),
    teams: list(source.teams, 8),
    music: list(source.music, 10),
    ...(() => {
      const artists = list(source.artists, 10);
      return artists.length ? { artists } : {};
    })(),
    events: list(source.events, 10),
    family,
    favoriteTrips: list(source.favoriteTrips, 8),
    interests: list(source.interests, 14),
    food: list(source.food, 8),
    summary: str(source.summary, 240) ?? '',
    listening: normalizeListening(source.listening),
    style: normalizeStyle(source.style),
    bestMoments: (() => {
      const moments = (Array.isArray(source.bestMoments) ? source.bestMoments : [])
        .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        .map((m) => m.trim().slice(0, 400))
        .slice(0, 5);
      return moments.length ? moments : undefined;
    })(),
  };
}

function normalizeStyle(input: unknown): TravelStyle | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const s = input as Record<string, unknown>;
  const pick = <T extends string>(value: unknown, allowed: readonly T[]) => (allowed.includes(value as T) ? (value as T) : undefined);
  const list = (value: unknown, max = 10) =>
    uniq((Array.isArray(value) ? value : []).filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim().slice(0, 80))).slice(0, max);
  const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);
  const style: TravelStyle = {
    budget: pick(s.budget, BUDGETS),
    pace: pick(s.pace, PACES),
    social: pick(s.social, SOCIAL_LEVELS),
    lodging: list(s.lodging, 6),
    homeAirport: text(s.homeAirport, 4)?.toUpperCase().replace(/[^A-Z]/g, '') || undefined,
    dietary: list(s.dietary, 8),
    avoid: list(s.avoid, 10),
    bucketList: list(s.bucketList, 12),
    languages: list(s.languages, 8),
    notes: text(s.notes, 600),
  };
  const empty = !style.budget && !style.pace && !style.social && !style.homeAirport && !style.notes &&
    [style.lodging, style.dietary, style.avoid, style.bucketList, style.languages].every((l) => l.length === 0);
  return empty ? undefined : style;
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
  const style = profile.style;
  if (style?.social === 'meet-everyone' || style?.lodging.some((l) => /hostel|social/i.test(l))) tags.add('nightlife');
  if (style?.pace === 'slow') tags.add('wellness');
  if (style?.pace === 'packed') tags.add('active');
  return [...tags];
}

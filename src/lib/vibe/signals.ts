import type { TravelerProfile } from '@/lib/designer/profile';

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The Vibe profile's building blocks: signals, not checkboxes. Each signal is
 * something about how a person gets down that can be matched against what we
 * learn about a place: opening hours, the kind of bar, a team's home fixture,
 * a genre on the bill. A signal carries how strongly it holds (loves, likes,
 * avoids), where it came from, and which kind of trip it applies to.
 *
 * Plain data and pure functions, shared by the profile page, the voice
 * concierge (which adds signals as it hears them) and the matcher.
 */

export type SignalGroup = 'nights' | 'music' | 'food' | 'sports' | 'culture' | 'rhythm' | 'stay' | 'money' | 'logistics';
export type Strength = 'love' | 'like' | 'avoid';
export type SignalSource = 'said' | 'spotify' | 'picked' | 'inferred';
export type SignalContext = 'any' | 'solo' | 'family' | 'work' | 'crew';

export type Signal = {
  /** "nights:last-call" or a named one: "music:artist:fred-again", "sports:team:fc-barcelona". */
  key: string;
  label: string;
  strength: Strength;
  source: SignalSource;
  context?: SignalContext;
  /** Their words, when they gave a detail ("Mezcal, never tequila"). */
  note?: string;
};

/** How far the concierge may push them past their usual taste: 0 never, 4 surprise me. */
export type VibeDials = { stretch: 0 | 1 | 2 | 3 | 4 };

export const GROUPS: Record<SignalGroup, { label: string; emoji: string; blurb: string }> = {
  nights: { label: 'Nights', emoji: '🌙', blurb: 'How the night goes, and how late' },
  music: { label: 'Music', emoji: '🎧', blurb: 'What you’d fly to hear' },
  food: { label: 'Food & drink', emoji: '🍽️', blurb: 'The table and the glass' },
  sports: { label: 'Sports & teams', emoji: '🏟️', blurb: 'Who you root for, what you play' },
  culture: { label: 'Culture', emoji: '🎭', blurb: 'Laughs, art, stages' },
  rhythm: { label: 'Rhythm', emoji: '⏱️', blurb: 'Your day’s shape' },
  stay: { label: 'Stay', emoji: '🛏️', blurb: 'Where you sleep, and what’s outside' },
  money: { label: 'Splurge & save', emoji: '💸', blurb: 'Where the money goes' },
  logistics: { label: 'Getting around', emoji: '🧭', blurb: 'Airports, rides, seats' },
};

/**
 * The fixed vocabulary. `words` finds the signal in what someone says and in
 * what a venue's description, category or reviews say. Named signals (artists,
 * teams, cuisines, genres) are built on the fly.
 */
export type VocabEntry = { key: string; group: SignalGroup; label: string; words: RegExp; venue?: RegExp };

export const VOCAB: readonly VocabEntry[] = [
  // Nights
  { key: 'nights:last-call', group: 'nights', label: 'Shuts the bar down', words: /\b(shut(?:ting)? (?:the|it) (?:bar|place) down|close (?:the|it) down|closing (?:the )?bar|last (?:ones|one) out|out (?:till|until) (?:[2-6]|close|sunrise)|late nights?|night owl|after ?hours?)\b/i, venue: /\b(late[- ]night|till (?:2|3|4|5|6)|until (?:2|3|4|5|6)|after ?hours?|open late)\b/i },
  { key: 'nights:early-night', group: 'nights', label: 'Early nights', words: /\b(early (?:night|to bed)|in bed by|not (?:a|much of a) night|lights out early)\b/i },
  { key: 'nights:dance', group: 'nights', label: 'Dance floors', words: /\b(danc(?:e|ing)|dance ?floor|clubs?|clubbing)\b/i, venue: /\b(night ?club|club|dance ?floor|dj)\b/i },
  { key: 'nights:cocktail-bar', group: 'nights', label: 'Serious cocktail bars', words: /\b(cocktails?|mixolog\w*|craft cocktails?)\b/i, venue: /\b(cocktail|mixolog|bartender)\b/i },
  { key: 'nights:dive-bar', group: 'nights', label: 'Dive bars', words: /\b(dive bars?|dives?|hole[- ]in[- ]the[- ]wall)\b/i, venue: /\b(dive bar|dive|no[- ]frills|cheap beer)\b/i },
  { key: 'nights:rooftop', group: 'nights', label: 'Rooftops', words: /\b(rooftops?|roof ?top)\b/i, venue: /\b(rooftop|roof terrace|sky ?bar)\b/i },
  { key: 'nights:speakeasy', group: 'nights', label: 'Hidden bars', words: /\b(speakeasy|speakeasies|hidden bars?|secret bars?)\b/i, venue: /\b(speakeasy|hidden|secret|unmarked)\b/i },
  { key: 'nights:live-music', group: 'nights', label: 'Live music bars', words: /\b(live music|live bands?|live sets?|jazz clubs?|open mic)\b/i, venue: /\b(live music|live band|jazz club|stage|gig)\b/i },
  { key: 'nights:wine-bar', group: 'nights', label: 'Wine bars', words: /\b(wine bars?|natural wine|natty wine)\b/i, venue: /\b(wine bar|natural wine|enoteca|bodega)\b/i },
  { key: 'nights:lounge', group: 'nights', label: 'Lounges', words: /\b(lounges?|hotel bars?)\b/i, venue: /\b(lounge|hotel bar)\b/i },
  { key: 'nights:apres', group: 'nights', label: 'Après', words: /\b(apr[eè]s)\b/i, venue: /\b(apr[eè]s)\b/i },
  { key: 'nights:karaoke', group: 'nights', label: 'Karaoke', words: /\bkaraoke\b/i, venue: /\bkaraoke\b/i },
  // Food & drink
  { key: 'food:tasting-menu', group: 'food', label: 'Tasting menus', words: /\b(tasting menus?|michelin|fine dining|omakase|chef'?s table)\b/i, venue: /\b(tasting menu|michelin|fine dining|omakase|chef'?s table)\b/i },
  { key: 'food:street-food', group: 'food', label: 'Street food', words: /\b(street food|taco trucks?|food trucks?|hawker|night markets?)\b/i, venue: /\b(street food|taco|food truck|hawker|market)\b/i },
  { key: 'food:seafood', group: 'food', label: 'Seafood', words: /\b(seafood|oysters?|sushi|crudo|raw bar)\b/i, venue: /\b(seafood|oyster|sushi|crudo|raw bar|fish)\b/i },
  { key: 'food:steak', group: 'food', label: 'Steakhouses', words: /\b(steaks?|steakhouses?|asado|churrasc\w*)\b/i, venue: /\b(steak|asado|churrasc|grill)\b/i },
  { key: 'food:pizza', group: 'food', label: 'Pizza', words: /\bpizza\b/i, venue: /\bpizz/i },
  { key: 'food:bbq', group: 'food', label: 'Barbecue', words: /\b(bbq|barbecue|smokehouse)\b/i, venue: /\b(bbq|barbecue|smokehouse)\b/i },
  { key: 'food:brunch', group: 'food', label: 'Brunch', words: /\bbrunch\b/i, venue: /\bbrunch\b/i },
  { key: 'food:coffee', group: 'food', label: 'Great coffee', words: /\b(coffee|espresso|flat whites?|third[- ]wave)\b/i, venue: /\b(coffee|espresso|roaster)\b/i },
  { key: 'food:wine', group: 'food', label: 'Wine', words: /\b(wine|vino|sommelier|vineyards?|winer(?:y|ies))\b/i, venue: /\b(wine|sommelier|vineyard|winery|cellar)\b/i },
  { key: 'food:mezcal', group: 'food', label: 'Mezcal & tequila', words: /\b(mezcal|tequila|agave)\b/i, venue: /\b(mezcal|tequila|agave)\b/i },
  { key: 'food:whisky', group: 'food', label: 'Whisky', words: /\b(whisk(?:e)?y|bourbon|scotch)\b/i, venue: /\b(whisk(?:e)?y|bourbon|scotch)\b/i },
  { key: 'food:beer', group: 'food', label: 'Craft beer', words: /\b(craft beer|breweries|brewery|ipa|beer)\b/i, venue: /\b(brewery|craft beer|taproom|beer hall)\b/i },
  { key: 'food:locals-spot', group: 'food', label: 'Where locals eat', words: /\b(where (?:the )?locals (?:eat|go)|no tourists?|local spots?|hole[- ]in[- ]the[- ]wall)\b/i, venue: /\b(locals|neighbo(?:u)?rhood|family[- ]run|institution)\b/i },
  { key: 'food:vegetarian', group: 'food', label: 'Vegetarian', words: /\b(vegetarian|veggie|plant[- ]based)\b/i },
  { key: 'food:vegan', group: 'food', label: 'Vegan', words: /\bvegan\b/i },
  { key: 'food:gluten-free', group: 'food', label: 'Gluten-free', words: /\b(gluten[- ]free|celiac|coeliac)\b/i },
  // Sports (named teams are built on the fly)
  { key: 'sports:watch-football', group: 'sports', label: 'Watching football (soccer)', words: /\b(soccer|premier league|la liga|champions league|football match)\b/i, venue: /\b(football|soccer|la liga|premier league|champions league|derby)\b/i },
  { key: 'sports:watch-nfl', group: 'sports', label: 'NFL', words: /\b(nfl|american football)\b/i, venue: /\b(nfl)\b/i },
  { key: 'sports:watch-nba', group: 'sports', label: 'NBA', words: /\b(nba|basketball)\b/i, venue: /\b(nba|basketball)\b/i },
  { key: 'sports:watch-f1', group: 'sports', label: 'F1 and racing', words: /\b(f1|formula (?:1|one)|grand prix|racing)\b/i, venue: /\b(grand prix|f1|formula)\b/i },
  { key: 'sports:ski', group: 'sports', label: 'Skiing', words: /\b(ski(?:ing|er)?|snowboard(?:ing)?|powder)\b/i, venue: /\b(ski|slope|piste|gondola|powder)\b/i },
  { key: 'sports:golf', group: 'sports', label: 'Golf', words: /\bgolf\b/i, venue: /\bgolf\b/i },
  { key: 'sports:surf', group: 'sports', label: 'Surfing', words: /\bsurf(?:ing)?\b/i, venue: /\bsurf/i },
  { key: 'sports:hike', group: 'sports', label: 'Hiking', words: /\b(hik(?:e|ing)|trails?|trek(?:king)?)\b/i, venue: /\b(hike|trail|trek)\b/i },
  { key: 'sports:gym', group: 'sports', label: 'Training on the road', words: /\b(gym|work ?out|crossfit|run(?:ning)? clubs?|pilates|yoga)\b/i, venue: /\b(gym|fitness|yoga|pilates|run club)\b/i },
  // Culture
  { key: 'culture:comedy', group: 'culture', label: 'Stand-up comedy', words: /\b(comedy|stand[- ]?up|comedians?)\b/i, venue: /\b(comedy|stand[- ]?up|comedian)\b/i },
  { key: 'culture:art', group: 'culture', label: 'Art & galleries', words: /\b(art|galler(?:y|ies)|museums?|exhibitions?)\b/i, venue: /\b(gallery|museum|exhibition|art)\b/i },
  { key: 'culture:theatre', group: 'culture', label: 'Theatre & shows', words: /\b(theat(?:re|er)|broadway|musicals?|west end|opera|ballet)\b/i, venue: /\b(theat(?:re|er)|musical|opera|ballet)\b/i },
  { key: 'culture:architecture', group: 'culture', label: 'Architecture', words: /\barchitecture\b/i, venue: /\barchitect/i },
  { key: 'culture:history', group: 'culture', label: 'History', words: /\b(history|historic|ruins)\b/i, venue: /\b(histor|ruins|ancient)\b/i },
  { key: 'culture:fashion', group: 'culture', label: 'Fashion & shopping', words: /\b(fashion|shopping|boutiques?|vintage)\b/i, venue: /\b(fashion|boutique|vintage|concept store)\b/i },
  { key: 'culture:festivals', group: 'culture', label: 'Festivals', words: /\bfestivals?\b/i, venue: /\bfestival\b/i },
  // Rhythm
  { key: 'rhythm:early-riser', group: 'rhythm', label: 'Up early', words: /\b(early riser|up early|sunrise|first chair|morning person)\b/i },
  { key: 'rhythm:sleep-in', group: 'rhythm', label: 'Sleeps in', words: /\b(sleep in|slow mornings?|not a morning person|late riser)\b/i },
  { key: 'rhythm:packed', group: 'rhythm', label: 'Packs it in', words: /\b(packed|non[- ]?stop|go go go|see everything|every minute)\b/i },
  { key: 'rhythm:slow', group: 'rhythm', label: 'Slow travel', words: /\b(slow|chill|laid[- ]back|relax(?:ed|ing)?|do nothing)\b/i },
  { key: 'rhythm:walker', group: 'rhythm', label: 'Walks everywhere', words: /\b(walk(?:ing)? everywhere|on foot|walkable)\b/i },
  // Stay
  { key: 'stay:in-the-action', group: 'stay', label: 'In the middle of it', words: /\b(in the (?:middle|thick) of (?:it|things)|walk(?:ing)? distance|downtown|central)\b/i },
  { key: 'stay:quiet', group: 'stay', label: 'Quiet stays', words: /\b(quiet (?:hotel|place|stay)|away from (?:it all|the noise)|secluded)\b/i },
  { key: 'stay:boutique', group: 'stay', label: 'Boutique hotels', words: /\bboutique\b/i },
  { key: 'stay:luxury', group: 'stay', label: 'Five-star', words: /\b(five[- ]star|5[- ]star|luxury|aman|four seasons|ritz)\b/i },
  { key: 'stay:villa', group: 'stay', label: 'Villas & houses', words: /\b(villas?|airbnb|vrbo|whole house|chalet)\b/i },
  { key: 'stay:pool', group: 'stay', label: 'A pool', words: /\bpool\b/i },
  { key: 'stay:spa', group: 'stay', label: 'Spa', words: /\b(spa|massages?|sauna|hammam)\b/i, venue: /\b(spa|sauna|hammam|thermal)\b/i },
  // Money
  { key: 'money:splurge-food', group: 'money', label: 'Splurges on food', words: /\b(splurge on (?:food|dinner|restaurants?)|money (?:goes )?on food|worth it for (?:a|the) meal)\b/i },
  { key: 'money:splurge-stay', group: 'money', label: 'Splurges on the hotel', words: /\b(splurge on (?:the )?(?:hotel|room|stay)|nice hotels?)\b/i },
  { key: 'money:splurge-experiences', group: 'money', label: 'Splurges on experiences', words: /\b(splurge on (?:experiences|tickets|shows)|pay for the experience|vip|bottle service)\b/i },
  { key: 'money:saves-flights', group: 'money', label: 'Saves on flights', words: /\b(cheap flights?|economy|budget airlines?|save on (?:the )?flights?)\b/i },
  // Getting around
  { key: 'logistics:rideshare', group: 'logistics', label: 'Uber and Lyft', words: /\b(uber|lyft|rideshare|ride[- ]share)\b/i },
  { key: 'logistics:transit', group: 'logistics', label: 'Public transit', words: /\b(subway|metro|train|transit|tube)\b/i },
  { key: 'logistics:car', group: 'logistics', label: 'Rents a car', words: /\b(rent(?:al)? car|car rental|road trip|drive (?:myself|ourselves))\b/i },
  { key: 'logistics:window-seat', group: 'logistics', label: 'Window seat', words: /\bwindow seat\b/i },
  { key: 'logistics:aisle-seat', group: 'logistics', label: 'Aisle seat', words: /\baisle seat\b/i },
];

const VOCAB_BY_KEY = new Map(VOCAB.map((entry) => [entry.key, entry]));
const NAMED_PREFIXES = ['music:artist:', 'music:genre:', 'sports:team:', 'food:cuisine:', 'culture:venue:'] as const;
const slug = (value: string) => fold(value).replace(/ /g, '-').slice(0, 60);

export function groupOf(key: string): SignalGroup | null {
  const vocab = VOCAB_BY_KEY.get(key);
  if (vocab) return vocab.group;
  const prefix = NAMED_PREFIXES.find((p) => key.startsWith(p));
  return prefix ? (prefix.split(':')[0] as SignalGroup) : null;
}

/** A signal from outside (the voice backend, an import) is kept only if its key is ours. */
export function cleanSignal(raw: unknown, source: SignalSource = 'said'): Signal | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const strength = value.strength === 'love' || value.strength === 'like' || value.strength === 'avoid' ? value.strength : 'like';
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  let key = text(value.key, 90).toLowerCase();
  const label = text(value.label, 50);
  const prefix = NAMED_PREFIXES.find((p) => key.startsWith(p));
  if (prefix) {
    const name = key.slice(prefix.length);
    if (!name) return null;
    key = `${prefix}${slug(name)}`;
  } else if (!VOCAB_BY_KEY.has(key)) {
    return null;
  }
  const context = ['solo', 'family', 'work', 'crew'].includes(String(value.context)) ? (value.context as SignalContext) : undefined;
  const note = text(value.note, 120);
  return { key, label: label || VOCAB_BY_KEY.get(key)?.label || key.split(':').pop()!.replace(/-/g, ' '), strength, source, ...(context ? { context } : {}), ...(note ? { note } : {}) };
}

export function named(prefix: (typeof NAMED_PREFIXES)[number], name: string, strength: Strength, source: SignalSource): Signal {
  return { key: `${prefix}${slug(name)}`, label: name, strength, source };
}

/** Later wins for the same key (they changed their mind); nothing is duplicated. */
export function mergeSignals(existing: readonly Signal[], incoming: readonly Signal[]): Signal[] {
  const out = new Map(existing.map((signal) => [signal.key, signal]));
  for (const signal of incoming) {
    const before = out.get(signal.key);
    // Something they said beats something we inferred; otherwise the newer word stands.
    if (before && before.source === 'said' && signal.source === 'inferred') continue;
    out.set(signal.key, { ...before, ...signal });
  }
  return [...out.values()].slice(0, 200);
}

const AVOID_LEAD = /\b(?:no|not|never|hate|can'?t stand|skip|avoid|allergic to|don'?t (?:do|like|want|drink|eat))\b[^.,;!?]{0,24}$/i;

/** What someone said, read on this device: vocabulary hits, with "no clubs" read as avoid. */
export function signalsFromText(text: string, source: SignalSource = 'said'): Signal[] {
  const out: Signal[] = [];
  for (const entry of VOCAB) {
    const match = entry.words.exec(text);
    if (!match) continue;
    const before = text.slice(Math.max(0, match.index - 40), match.index);
    const avoid = AVOID_LEAD.test(before);
    const love = /\b(love|obsessed|live for|always|huge|big fan|favorite|favourite)\b[^.,;!?]{0,20}$/i.test(before);
    out.push({ key: entry.key, label: entry.label, strength: avoid ? 'avoid' : love ? 'love' : 'like', source });
  }
  return out;
}

/** The signals an existing profile already implies, so older profiles show a full picture too. */
export function signalsFromProfile(profile: TravelerProfile): Signal[] {
  const out: Signal[] = [];
  for (const artist of profile.artists ?? []) out.push(named('music:artist:', artist, 'love', 'said'));
  for (const artist of profile.listening?.topArtists ?? []) out.push(named('music:artist:', artist, 'love', 'spotify'));
  for (const genre of profile.music) out.push(named('music:genre:', genre, 'like', 'said'));
  for (const genre of profile.listening?.genres ?? []) out.push(named('music:genre:', genre, 'like', 'spotify'));
  for (const team of profile.teams) out.push(named('sports:team:', team, 'love', 'said'));
  const text = [profile.food.join(', '), profile.interests.join(', '), profile.events.join(', '), profile.summary, profile.style?.notes ?? '', (profile.style?.lodging ?? []).join(', ')].join('. ');
  out.push(...signalsFromText(text));
  for (const food of profile.food) if (!VOCAB.some((entry) => entry.group === 'food' && entry.words.test(food))) out.push(named('food:cuisine:', food, 'like', 'said'));
  for (const no of profile.style?.avoid ?? []) {
    const hit = VOCAB.find((entry) => entry.words.test(no));
    out.push(hit ? { key: hit.key, label: hit.label, strength: 'avoid', source: 'said' } : { key: `culture:venue:${slug(no)}`, label: no, strength: 'avoid', source: 'said' });
  }
  // Spotify says when they listen: lots of 10pm–4am plays reads as a late-night person (inferred, so they can correct it).
  if ((profile.listening?.nightOwl ?? 0) >= 0.35) out.push({ key: 'nights:last-call', label: 'Shuts the bar down', strength: 'like', source: 'inferred' });
  if (profile.style?.pace === 'packed') out.push({ key: 'rhythm:packed', label: 'Packs it in', strength: 'like', source: 'said' });
  if (profile.style?.pace === 'slow') out.push({ key: 'rhythm:slow', label: 'Slow travel', strength: 'like', source: 'said' });
  if (profile.style?.budget === 'premium' || profile.style?.budget === 'no-limit') out.push({ key: 'stay:luxury', label: 'Five-star', strength: 'like', source: 'inferred' });
  return mergeSignals([], out);
}

/** Every signal for this profile: implied by its facts, then what was added directly (which wins). */
export function allSignals(profile: TravelerProfile): Signal[] {
  return mergeSignals(signalsFromProfile(profile), profile.signals ?? []);
}

/** A compact line for a model: loves, likes and avoids, most telling first. At most `max` characters. */
export function vibeLine(signals: readonly Signal[], dials?: VibeDials, max = 600): string {
  const by = (strength: Strength) => signals.filter((signal) => signal.strength === strength).map((signal) => signal.note ? `${signal.label} (${signal.note})` : signal.label);
  const parts = [
    by('love').length ? `Loves: ${by('love').join(', ')}.` : '',
    by('like').length ? `Likes: ${by('like').join(', ')}.` : '',
    by('avoid').length ? `Avoids: ${by('avoid').join(', ')}.` : '',
    dials ? `Comfort-zone stretch: ${dials.stretch} of 4.` : '',
  ];
  return parts.filter(Boolean).join(' ').slice(0, max);
}

export function vocabFor(key: string): VocabEntry | undefined {
  return VOCAB_BY_KEY.get(key);
}

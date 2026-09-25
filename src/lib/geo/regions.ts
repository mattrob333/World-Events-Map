import { COUNTRY_NAMES } from './countries';

/**
 * Plain geography for reading a trip request: which countries a region spans
 * ("the Alps" is Switzerland, France, Austria, Italy, Germany, Slovenia and
 * Liechtenstein), country aliases, and US states. Deliberately small and
 * hand-checked; it only has to know what travelers say out loud.
 */
export type Where = {
  /** What they said, tidied: "the Alps", "Japan", "Colorado". */
  label: string;
  kind: 'region' | 'country' | 'state';
  /** Countries it covers, in the calendar's spelling. */
  countries: string[];
  /** For US states: the state name, to match cities there. */
  state?: string;
  /** Ski, beach…: what the region is known for, when it's one thing. */
  hint?: 'ski' | 'beach';
};

type RegionDef = { pattern: RegExp; label: string; countries: string[]; hint?: Where['hint'] };

const REGIONS: RegionDef[] = [
  { pattern: /\b(?:the\s+)?(?:swiss|french|austrian|italian|bavarian)?\s*alps\b|\balpine\b/i, label: 'the Alps', countries: ['Switzerland', 'France', 'Austria', 'Italy', 'Germany', 'Slovenia', 'Liechtenstein'], hint: 'ski' },
  { pattern: /\bdolomites\b/i, label: 'the Dolomites', countries: ['Italy'], hint: 'ski' },
  { pattern: /\bpyrenees\b/i, label: 'the Pyrenees', countries: ['Spain', 'France', 'Andorra'], hint: 'ski' },
  { pattern: /\b(?:the\s+)?rock(?:y|ies)(?:\s+mountains)?\b/i, label: 'the Rockies', countries: ['United States', 'Canada'], hint: 'ski' },
  { pattern: /\bandes\b|\bpatagonia\b/i, label: 'the Andes', countries: ['Chile', 'Argentina', 'Peru', 'Ecuador', 'Bolivia'] },
  { pattern: /\bhimalaya(?:s|n)?\b/i, label: 'the Himalayas', countries: ['Nepal', 'Bhutan', 'India', 'China'] },
  { pattern: /\bscandinavia(?:n)?\b|\bnordics?\b/i, label: 'Scandinavia', countries: ['Norway', 'Sweden', 'Denmark', 'Finland', 'Iceland'] },
  { pattern: /\bcaribbean\b|\bwest indies\b/i, label: 'the Caribbean', countries: ['Bahamas', 'Barbados', 'Antigua and Barbuda', 'Saint Barthelemy', 'Saint Barthélemy', 'Jamaica', 'Turks and Caicos Islands', 'Cayman Islands', 'Puerto Rico', 'Dominican Republic', 'Saint Lucia', 'Aruba', 'Curacao', 'Trinidad and Tobago', 'British Virgin Islands', 'U.S. Virgin Islands', 'Anguilla', 'Grenada', 'Saint Vincent and the Grenadines', 'Martinique', 'Guadeloupe', 'Saint Martin', 'Sint Maarten', 'Cuba'], hint: 'beach' },
  { pattern: /\bmediterranean\b|\bthe med\b/i, label: 'the Mediterranean', countries: ['Spain', 'France', 'Monaco', 'Italy', 'Malta', 'Greece', 'Croatia', 'Montenegro', 'Cyprus', 'Turkey', 'Morocco', 'Tunisia'], hint: 'beach' },
  { pattern: /\b(?:french\s+)?riviera\b|\bcote d'?azur\b|\bcôte d’?azur\b/i, label: 'the Riviera', countries: ['France', 'Monaco', 'Italy'], hint: 'beach' },
  { pattern: /\bamalfi(?:\s+coast)?\b|\btuscany\b|\bsicily\b|\bsardinia\b|\blake como\b/i, label: 'Italy', countries: ['Italy'] },
  { pattern: /\bgreek islands\b|\bcyclades\b/i, label: 'the Greek islands', countries: ['Greece'], hint: 'beach' },
  { pattern: /\bbalearics?\b|\bcanary islands\b|\bcanaries\b/i, label: 'the Spanish islands', countries: ['Spain'], hint: 'beach' },
  { pattern: /\bbalkans\b/i, label: 'the Balkans', countries: ['Croatia', 'Slovenia', 'Montenegro', 'Serbia', 'Bosnia and Herzegovina', 'Albania', 'North Macedonia', 'Greece', 'Bulgaria'] },
  { pattern: /\bsouth(?:\s*|-)?east asia\b/i, label: 'Southeast Asia', countries: ['Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Singapore', 'Philippines', 'Cambodia', 'Laos'] },
  { pattern: /\bmiddle east\b|\bgulf states\b/i, label: 'the Middle East', countries: ['United Arab Emirates', 'Qatar', 'Oman', 'Saudi Arabia', 'Jordan', 'Bahrain', 'Israel', 'Egypt'] },
  { pattern: /\bcentral america\b/i, label: 'Central America', countries: ['Mexico', 'Belize', 'Guatemala', 'Costa Rica', 'Panama', 'Nicaragua', 'Honduras', 'El Salvador'] },
  { pattern: /\bsouth america\b/i, label: 'South America', countries: ['Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Ecuador', 'Uruguay', 'Bolivia', 'Paraguay'] },
  { pattern: /\b(?:east|southern)\s+africa\b|\bsafari country\b/i, label: 'East and Southern Africa', countries: ['Kenya', 'Tanzania', 'Uganda', 'Rwanda', 'South Africa', 'Botswana', 'Namibia', 'Zambia', 'Zimbabwe'] },
  { pattern: /\bnew england\b/i, label: 'New England', countries: ['United States'] },
  { pattern: /\bscotland\b|\bengland\b|\bwales\b|\bbritain\b|\bthe uk\b|\bu\.k\.\b/i, label: 'the UK', countries: ['United Kingdom'] },
  { pattern: /\beurope\b/i, label: 'Europe', countries: ['France', 'Italy', 'Spain', 'Portugal', 'Germany', 'Switzerland', 'Austria', 'United Kingdom', 'Ireland', 'Netherlands', 'Belgium', 'Denmark', 'Sweden', 'Norway', 'Finland', 'Iceland', 'Greece', 'Croatia', 'Czech Republic', 'Hungary', 'Poland', 'Monaco', 'Malta', 'Slovenia', 'Montenegro'] },
  { pattern: /\basia\b/i, label: 'Asia', countries: ['Japan', 'South Korea', 'China', 'Hong Kong', 'Hong Kong SAR', 'Hong Kong SAR China', 'Singapore', 'Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Philippines', 'India', 'Sri Lanka', 'Maldives', 'Bhutan', 'Nepal', 'Mongolia'] },
  { pattern: /\bafrica\b/i, label: 'Africa', countries: ['Morocco', 'Egypt', 'Kenya', 'Tanzania', 'South Africa', 'Botswana', 'Namibia', 'Rwanda', 'Uganda', 'Zambia', 'Zimbabwe', 'Ethiopia'] },
];

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'United States', 'u.s.': 'United States', 'u.s.a.': 'United States', 'the us': 'United States', 'the states': 'United States', america: 'United States',
  uk: 'United Kingdom', 'great britain': 'United Kingdom', uae: 'United Arab Emirates', dubai: 'United Arab Emirates',
  korea: 'South Korea', czechia: 'Czech Republic', holland: 'Netherlands', 'hong kong': 'Hong Kong', 'st barts': 'Saint Barthelemy', 'st. barts': 'Saint Barthelemy',
};

const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington State', 'West Virginia', 'Wisconsin', 'Wyoming'];
// "Georgia" and "Washington" are left out: a country and a city say those more often.

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (value: string) => new RegExp(`(^|[^\\p{L}])${escape(fold(value))}($|[^\\p{L}])`, 'u');

// Countries whose names are also common words or cities are only read with "in"/"to" before them.
const AMBIGUOUS = new Set(['Chad', 'Georgia', 'Jersey', 'Turkey', 'Jordan', 'Guinea', 'Niger', 'Mali', 'Oman', 'Peru', 'Nauru', 'Dominica']);

/** Every region, country and US state named in the text, first mention first. */
export function wheresIn(text: string): Where[] {
  const folded = fold(text);
  const found: { at: number; where: Where }[] = [];
  const seen = new Set<string>();
  const add = (at: number, where: Where) => {
    if (at < 0 || seen.has(where.label)) return;
    seen.add(where.label);
    found.push({ at, where });
  };
  for (const region of REGIONS) {
    const match = region.pattern.exec(text);
    if (match) add(match.index, { label: region.label, kind: 'region', countries: region.countries, hint: region.hint });
  }
  for (const [alias, country] of Object.entries(COUNTRY_ALIASES)) {
    const match = wordRe(alias).exec(folded);
    if (match) add(match.index, { label: country, kind: 'country', countries: [country] });
  }
  for (const country of COUNTRY_NAMES) {
    const re = AMBIGUOUS.has(country) ? new RegExp(`\\b(?:in|to|visit)\\s+${escape(fold(country))}\\b`, 'u') : wordRe(country);
    const match = re.exec(folded);
    if (match) add(match.index, { label: country, kind: 'country', countries: [country] });
  }
  for (const state of US_STATES) {
    const name = state.replace(' State', '');
    const match = wordRe(name).exec(folded);
    if (match) add(match.index, { label: name, kind: 'state', countries: ['United States'], state: name });
  }
  // "the Alps" already covers Switzerland when both are said; keep both, the region reads first.
  return found.sort((a, b) => a.at - b.at).map((entry) => entry.where);
}

const norm = (value: string) => fold(value).replace(/[^a-z]/g, '');

/** Does an event's country fall inside what they said? */
export function inWheres(country: string, wheres: readonly Where[]): boolean {
  const target = norm(country);
  return wheres.some((where) => where.countries.some((name) => {
    const candidate = norm(name);
    return candidate === target || target.startsWith(candidate) || candidate.startsWith(target);
  }));
}

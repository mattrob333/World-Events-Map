/**
 * "Travel smarter": the craft of traveling well, from the points blogs, gear
 * reviewers and travel magazines in the source library. Stories are sorted
 * into lanes by what they're about; incidents and bad news are left out.
 * Pure, so the rules are tested apart from the database.
 */

export type LaneKey = 'hostels' | 'gear' | 'lounges' | 'points' | 'deals' | 'stays' | 'tips';

export const LANES: readonly { key: LaneKey; label: string; emoji: string; test: RegExp }[] = [
  { key: 'hostels', label: 'Hostels', emoji: '🛏️', test: /\bhostels?\b/i },
  { key: 'gear', label: 'Gear & gadgets', emoji: '🎒', test: /\b(luggage|carry-?ons?|suitcases?|backpacks?|packing|gadgets?|headphones|earbuds|chargers?|power ?banks?|airtags?|travel (?:bags?|gear|pillows?|adapters?)|duffels?|slings?|one-?bag|packing cubes?)\b/i },
  { key: 'lounges', label: 'Lounges & upgrades', emoji: '🥂', test: /\b(lounges?|business class|first class|upgrades?d?|suites? (?:class|seat)|priority pass|centurion|polaris|admirals club|sky ?club|flagship|chelsea|spa treatments?)\b/i },
  { key: 'points', label: 'Points & perks', emoji: '💳', test: /\b(points?|miles|award (?:seats?|flights?|travel)|transfer bonus(?:es)?|elite status|bonvoy|hilton honors|world of hyatt|hyatt|amex|american express|chase|sapphire|aadvantage|skymiles|mileageplus|avios|velocity|credit cards?|welcome offers?|sign-?up bonus|redeem|redemptions?|statement credits?)\b/i },
  { key: 'deals', label: 'Deals', emoji: '🏷️', test: /(?:[£$€]\s?\d{2,}|\b(?:fare sale|error fares?|flash sale|deals?|cheap(?:est)?|bargains?|half[- ]price)\b)/i },
  { key: 'stays', label: 'Stays & openings', emoji: '🏝️', test: /\b(all-inclusive|resorts?|new hotels?|hotel openings?|opens?|opening|villas?|boutique hotels?|safari camps?|where to stay)\b/i },
  { key: 'tips', label: 'Tips & hacks', emoji: '🧠', test: /\b(tips?|hacks?|how to|what to do|mistakes?|checklist|tricks?|beware|should you|worth it|guide to|here'?s what)\b/i },
];

/** How lanes are shown: the money-saving ones first. LANES order is match priority. */
export const LANE_ORDER: readonly LaneKey[] = ['points', 'lounges', 'deals', 'stays', 'gear', 'hostels', 'tips'];

/** Incidents, crime and disasters are news, but not the craft of traveling well. */
const NOISE = /\b(handcuff\w*|arrest\w*|police|courts?|lawsuits?|sued|immunity|mayday|crash\w*|dies|died|death|dead|killed|injur\w*|hurricanes?|shooting|stabb\w*|brawl|bodycam|naked|fined|scam\w*|duped|layoffs?|earnings|strikes?|collaps\w*|apy|brokerage|balance transfers?|hustled|fashion week|discount codes?)\b/i;
const NOT_ENGLISH = /(?:^|\s)(?:le|la|les|des|du|une|et|pour|que|el|los|las|del|und|der|die|das|il|della|di)(?=\s)/gi;

const EVERY: readonly LaneKey[] = LANES.map((lane) => lane.key);
const STYLE: readonly LaneKey[] = ['stays', 'lounges', 'tips', 'hostels'];

/**
 * Who we read for what. Points and deal blogs can land anywhere; luxury
 * magazines only on stays, lounges and tips; lifestyle sites only when it's
 * gear, so their watches and vintage cars stay out. Gear reviewers are gear.
 */
export const SMARTER_SOURCES: Readonly<Record<string, readonly LaneKey[]>> = {
  ...Object.fromEntries([
    'One Mile at a Time', 'The Points Guy', 'View from the Wing', 'AwardWallet Blog', 'Frequent Miler', 'Head for Points',
    "Live and Let's Fly", 'Loyalty Lobby', 'Miles to Memories', 'Point Hacks', 'Prince of Travel', 'The MileLion',
    'Thrifty Traveler', 'Australian Frequent Flyer', 'Upgraded Points', 'Dollar Flight Club Blog', 'Fly4free',
    'HolidayPirates', 'The Flight Deal', 'Travel Off Path', 'Travel Pirates (US)', 'Travelzoo', 'Independent Travel',
    'Japan Cheapo', 'Tokyo Cheapo', 'Business Traveller', 'Caribbean Journal',
  ].map((name) => [name, EVERY])),
  ...Object.fromEntries([
    'Forbes Travel Guide Stories', 'Robb Report Travel', 'A Luxury Travel Blog', 'Condé Nast Traveler', 'Travel + Leisure',
    'Sleeper Magazine', 'Hotel Designs', 'Fathom', 'AFAR', 'Telegraph Travel',
  ].map((name) => [name, STYLE])),
  ...Object.fromEntries(['Man of Many', 'Gear Patrol', 'Cool Material', 'Uncrate', 'InsideHook'].map((name) => [name, ['gear'] as const])),
  ...Object.fromEntries(['Carryology', 'Pack Hacker', 'Google News: carry-on luggage review OR travel gear when:14d'].map((name) => [name, ['gear'] as const])),
};
const GEAR_HOUSES = /^(carryology|pack hacker|google news: carry-on)/i;

export function laneFor(title: string, excerpt = '', source = ''): LaneKey | null {
  const text = `${title}. ${excerpt}`;
  if (title.trim().split(/\s+/).length < 4 || NOISE.test(title)) return null;
  if ((title.match(NOT_ENGLISH) ?? []).length >= 2) return null;
  // Gear reviewers' stories are gear even when the headline doesn't say "luggage".
  if (GEAR_HOUSES.test(source)) return 'gear';
  const allowed = source ? SMARTER_SOURCES[source] ?? [] : EVERY;
  return LANES.find((lane) => allowed.includes(lane.key) && lane.test.test(text))?.key ?? null;
}

export type SmarterRow = { title: string; excerpt: string; url: string; source: string; tier: 'A' | 'B' | 'C'; publishedAt: string };
export type SmarterStory = SmarterRow & { lane: LaneKey };

/**
 * Newest first within a lane, at most `perLane`, one story per publisher per
 * lane, nothing older than `maxAgeDays`. Tier A sources win ties.
 */
export function pickSmarter(rows: readonly SmarterRow[], now: Date, { perLane = 8, maxAgeDays = 7 } = {}): SmarterStory[] {
  const oldest = new Date(now.getTime() - maxAgeDays * 86_400_000).toISOString();
  const seenTitle = new Set<string>();
  const byLane = new Map<LaneKey, SmarterStory[]>();
  const sorted = [...rows].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.tier.localeCompare(b.tier));
  for (const row of sorted) {
    if (row.publishedAt < oldest || row.publishedAt > now.toISOString()) continue;
    const key = row.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (seenTitle.has(key)) continue;
    const lane = laneFor(row.title, row.excerpt, row.source);
    if (!lane) continue;
    const list = byLane.get(lane) ?? [];
    if (list.length >= perLane || list.some((story) => story.source === row.source)) continue;
    seenTitle.add(key);
    list.push({ ...row, lane });
    byLane.set(lane, list);
  }
  return LANE_ORDER.flatMap((key) => byLane.get(key) ?? []);
}

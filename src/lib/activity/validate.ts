import { CATEGORIES, type Activity } from './activities';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*-([a-z]{2})$/;
const STATUSES = new Set(['confirmed', 'estimated', 'under-review']);
const LINK_KEYS = ['officialSite', 'tickets', 'wikipedia', 'instagram', 'youtube', 'tiktok'] as const;

const isHttps = (u: unknown) => {
  if (typeof u !== 'string') return false;
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

const validDay = (s: unknown) => typeof s === 'string' && ISO_DAY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

const validZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * Schema checks for the activity dataset. Errors fail `npm run data:validate`;
 * warnings are for a person to look at.
 */
export function validateActivities(list: readonly Activity[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const a of list) {
    const at = `activity ${a.id ?? '(no id)'}`;
    if (seen.has(a.id)) errors.push(`${at}: duplicate id`);
    seen.add(a.id);
    const idMatch = ID.exec(a.id ?? '');
    if (!idMatch) errors.push(`${at}: id must look like name-cc`);
    else if (idMatch[1] !== a.countryCode?.toLowerCase()) errors.push(`${at}: id suffix does not match countryCode ${a.countryCode}`);

    if (!a.name?.trim() || !a.place?.trim() || !a.country?.trim()) errors.push(`${at}: name, place and country are required`);
    if (!(Math.abs(a.lat) <= 90) || !(Math.abs(a.lng) <= 180)) errors.push(`${at}: coordinates out of range (${a.lat}, ${a.lng})`);
    if (!CATEGORIES.includes(a.category)) errors.push(`${at}: unknown category ${a.category}`);
    if (!a.summary?.trim()) errors.push(`${at}: summary is required`);
    else if (a.summary.length > 90) errors.push(`${at}: summary is ${a.summary.length} characters (max 90)`);
    if (a.summary?.includes('—') || a.note?.includes('—')) errors.push(`${at}: no em dashes in copy`);
    if (a.heat !== null && a.heat !== undefined && !(a.heat >= 0 && a.heat <= 100)) errors.push(`${at}: heat must be 0 to 100`);

    const monthsOk = (m: number[]) => Array.isArray(m) && m.every((x) => Number.isInteger(x) && x >= 1 && x <= 12);
    if (!monthsOk(a.bestMonths) || a.bestMonths.length === 0) errors.push(`${at}: bestMonths must be 1 to 12 and not empty`);
    if (!monthsOk(a.peakMonths)) errors.push(`${at}: peakMonths must be 1 to 12`);
    else if (a.peakMonths.some((m) => !a.bestMonths?.includes(m))) warnings.push(`${at}: a peak month is not a best month`);

    if (a.kind === 'event') {
      const ev = a.eventDates;
      if (!ev) {
        if (!a.datesNote?.trim()) errors.push(`${at}: events need dates, or a datesNote saying why not`);
      } else {
        if (!validDay(ev.start) || !validDay(ev.end)) errors.push(`${at}: event dates must be YYYY-MM-DD`);
        else if (ev.start > ev.end) errors.push(`${at}: event starts after it ends`);
        if (!STATUSES.has(ev.status)) errors.push(`${at}: unknown date status ${ev.status}`);
        if (!isHttps(ev.sourceUrl)) errors.push(`${at}: event dates need an https source`);
      }
    }

    if (!Array.isArray(a.sources) || a.sources.length === 0) errors.push(`${at}: at least one source is required`);
    else if (!a.sources.every(isHttps)) errors.push(`${at}: sources must be https URLs`);
    for (const key of LINK_KEYS) {
      const url = a.links?.[key];
      if (url !== undefined && !isHttps(url)) errors.push(`${at}: links.${key} must be an https URL`);
    }
    for (const tag of a.hashtags ?? []) {
      if (!/^[\p{L}\p{N}_]+$/u.test(tag)) errors.push(`${at}: hashtag "${tag}" must be letters, numbers or _ without #`);
    }
    for (const ap of a.nearestAirports ?? []) {
      if (!/^[A-Z]{3}$/.test(ap.iata)) errors.push(`${at}: airport code "${ap.iata}" must be three capital letters`);
    }
    if (a.tz && !validZone(a.tz)) errors.push(`${at}: unknown time zone ${a.tz}`);
    if (!a.tz) warnings.push(`${at}: no time zone`);
  }
  return { errors, warnings };
}

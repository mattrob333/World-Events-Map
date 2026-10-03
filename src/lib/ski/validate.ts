import { CURRENCIES, INTERESTS, PASSES, SCENE_KINDS, VIBES, type SceneItem, type SkiRange, type SkiResort } from './types';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const isHttps = (url: unknown) => {
  if (typeof url !== 'string') return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};
const validDay = (value: unknown) => typeof value === 'string' && ISO_DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const validMonths = (list: unknown) => Array.isArray(list) && list.length > 0 && list.every((month) => Number.isInteger(month) && month >= 1 && month <= 12);
const badCopy = (text: string) => /—|\bdope\b/i.test(text);

/**
 * Schema checks for the ski data. Errors fail `npm run data:validate` and the
 * tests; warnings are for a person to look at.
 */
export function validateSki(ranges: readonly SkiRange[], resorts: readonly SkiResort[], scene: readonly SceneItem[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rangeIds = new Set<string>();

  for (const range of ranges) {
    const at = `ski range ${range.id}`;
    if (!ID.test(range.id) || rangeIds.has(range.id)) errors.push(`${at}: bad or duplicate id`);
    rangeIds.add(range.id);
    if (!validMonths(range.seasonMonths) || !validMonths(range.bestMonths)) errors.push(`${at}: months must be 1 to 12`);
    if (range.bestMonths.some((month) => !range.seasonMonths.includes(month))) errors.push(`${at}: a best month outside the season`);
    if (range.summary.length > 90 || badCopy(range.summary)) errors.push(`${at}: summary too long or off-style`);
    if (!range.sources.length || !range.sources.every(isHttps)) errors.push(`${at}: needs https sources`);
  }

  const resortIds = new Set<string>();
  for (const resort of resorts) {
    const at = `ski resort ${resort.id}`;
    if (!ID.test(resort.id) || resortIds.has(resort.id)) errors.push(`${at}: bad or duplicate id`);
    resortIds.add(resort.id);
    if (!rangeIds.has(resort.rangeId)) errors.push(`${at}: unknown range ${resort.rangeId}`);
    if (!resort.name || !resort.place || !resort.country || !/^[A-Z]{2}$/.test(resort.countryCode)) errors.push(`${at}: missing name, place or country`);
    if (!(Math.abs(resort.lat) <= 90 && Math.abs(resort.lng) <= 180)) errors.push(`${at}: bad coordinates`);
    const { opensMonth, closesMonth, dates } = resort.season;
    if (![opensMonth, closesMonth].every((month) => Number.isInteger(month) && month >= 1 && month <= 12)) errors.push(`${at}: season months must be 1 to 12`);
    if (dates && (!validDay(dates.open) || (dates.close !== null && (!validDay(dates.close) || dates.open > dates.close)) || !isHttps(dates.sourceUrl))) errors.push(`${at}: bad season dates`);
    if (!validMonths(resort.bestMonths)) errors.push(`${at}: bestMonths must be 1 to 12`);
    if (!Array.isArray(resort.peakMonths) || !resort.peakMonths.every((month) => Number.isInteger(month) && month >= 1 && month <= 12)) errors.push(`${at}: peakMonths must be 1 to 12`);
    for (const value of [resort.topFt, resort.verticalFt, resort.skiableAcres, resort.trails]) {
      if (value !== null && !(Number.isFinite(value) && value > 0)) errors.push(`${at}: stats must be positive or null`);
    }
    if (resort.topFt !== null && resort.topFt > 20_000) errors.push(`${at}: top elevation over 20,000 ft`);
    if (resort.verticalFt !== null && resort.topFt !== null && resort.verticalFt > resort.topFt) errors.push(`${at}: vertical above the top`);
    if (!resort.passes.every((pass) => (PASSES as readonly string[]).includes(pass))) errors.push(`${at}: unknown pass`);
    const ticket = resort.liftTicket;
    if (ticket) {
      if (!(CURRENCIES as readonly string[]).includes(ticket.currency)) errors.push(`${at}: unknown currency`);
      if (!(ticket.low > 0 && ticket.high >= ticket.low)) errors.push(`${at}: lift ticket range must be low <= high, both positive`);
      if (ticket.high > ticket.low * 4) warnings.push(`${at}: lift ticket high is over 4x low, check it`);
      if (!isHttps(ticket.sourceUrl) || !validDay(ticket.checkedOn) || !/^\d{4}(\/\d{2})?$/.test(ticket.season)) errors.push(`${at}: lift ticket needs a source, a checked date and a season`);
    } else {
      warnings.push(`${at}: no lift ticket prices`);
    }
    if (!resort.vibe.length || !resort.vibe.every((vibe) => (VIBES as readonly string[]).includes(vibe))) errors.push(`${at}: vibe tags missing or unknown`);
    if (!resort.summary || resort.summary.length > 90 || badCopy(resort.summary)) errors.push(`${at}: summary missing, too long or off-style`);
    if (resort.why.length > 260 || badCopy(resort.why)) errors.push(`${at}: why too long or off-style`);
    if (!isHttps(resort.links.officialSite)) errors.push(`${at}: needs an https official site`);
    for (const url of [resort.links.tickets, resort.links.instagram, resort.family?.skiSchool]) {
      if (url !== undefined && !isHttps(url)) errors.push(`${at}: links must be https`);
    }
    if (!resort.nearestAirports.every((airport) => /^[A-Z]{3}$/.test(airport.iata) && airport.city)) errors.push(`${at}: bad airport`);
    if (!resort.sources.length || !resort.sources.every(isHttps)) errors.push(`${at}: needs https sources`);
  }

  const itemIds = new Set<string>();
  for (const item of scene) {
    const at = `ski scene ${item.id}`;
    if (itemIds.has(item.id) || !item.id.startsWith(`${item.resortId}--`)) errors.push(`${at}: duplicate id or not prefixed by its resort`);
    itemIds.add(item.id);
    if (!resortIds.has(item.resortId)) errors.push(`${at}: unknown resort ${item.resortId}`);
    if (!(SCENE_KINDS as readonly string[]).includes(item.kind)) errors.push(`${at}: unknown kind`);
    if (![1, 2, 3].includes(item.wow)) errors.push(`${at}: wow must be 1, 2 or 3`);
    if (!item.interests.length || !item.interests.every((interest) => (INTERESTS as readonly string[]).includes(interest))) errors.push(`${at}: interests missing or unknown`);
    if (!validMonths(item.months)) errors.push(`${at}: months must be 1 to 12`);
    if (!item.name || !item.summary || item.summary.length > 90 || badCopy(item.summary)) errors.push(`${at}: summary missing, too long or off-style`);
    if (item.dates && (!validDay(item.dates.start) || !validDay(item.dates.end) || item.dates.start > item.dates.end || !isHttps(item.dates.sourceUrl))) errors.push(`${at}: bad dates`);
    if (item.kind === 'event' && !item.dates && !item.datesNote) errors.push(`${at}: an event without dates needs a datesNote`);
    if (/[$€£¥]|\b\d[\d,.]*\s?(usd|eur|chf|cad|dollars|euros|francs)\b/i.test(item.summary)) errors.push(`${at}: no prices in copy`);
    for (const url of Object.values(item.links)) if (!isHttps(url)) errors.push(`${at}: links must be https`);
    if (!item.sources.length || !item.sources.every(isHttps)) errors.push(`${at}: needs https sources`);
  }

  for (const resort of resorts) {
    if (!scene.some((item) => item.resortId === resort.id)) warnings.push(`ski resort ${resort.id}: nothing to do around it yet`);
  }
  return { errors, warnings };
}

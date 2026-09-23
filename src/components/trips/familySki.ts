export type SkiRegion = 'compare' | 'rockies' | 'alps';
export type SkiStay = 'slopeside' | 'near-lifts' | 'flexible';

export interface FamilySkiInput {
  region: SkiRegion;
  start: string;
  end: string;
  origin: string;
  adults: number;
  children: number;
  anotherFamily: boolean;
  stay: SkiStay;
  nightlyBudget: string;
  /** Resorts already on the family's shortlist. Private brief only. */
  resorts?: string;
  /** Children's ages and lesson needs. Private brief only, never public. */
  childNotes?: string;
}

/** Longest window the planner accepts; a ski week, not a season. */
export const MAX_TRIP_DAYS = 60;

const REGION_DESTINATION: Record<SkiRegion, string> = {
  compare: 'Colorado Rockies or Swiss Alps',
  rockies: 'Colorado Rockies',
  alps: 'Swiss Alps',
};

const STAY_LABEL: Record<SkiStay, string> = {
  slopeside: 'Ski-in/ski-out preferred',
  'near-lifts': 'Near the lifts',
  flexible: 'Flexible on location',
};

/** Circle fields can be read by every signed-in member. Keep household details out. */
export function buildPublicSkiCircle(input: FamilySkiInput, hostId: string) {
  const destination = REGION_DESTINATION[input.region];
  return {
    host_id: hostId,
    name: input.region === 'compare' ? 'Family ski trip: Rockies or Alps' : `Family ski trip: ${destination}`,
    destination,
    departure_city: '',
    description: 'Exploring family-friendly ski towns, snow conditions, events, and stays. Request to join the planning conversation.',
    start_date: input.start,
    end_date: input.end,
    capacity: 8,
    event_id: null,
    party_type: 'family',
    tags: ['ski', 'winter', 'family'],
  };
}

/** This first message is covered by the circle_messages member-only RLS policy. */
export function buildPrivateSkiBrief(input: FamilySkiInput): string {
  const lines = [
    'Family ski trip planning brief',
    `Compare: ${REGION_DESTINATION[input.region]}`,
    input.resorts?.trim() ? `Resorts we're looking at: ${input.resorts.trim()}` : null,
    `Dates: ${input.start} to ${input.end}`,
    `Starting from: ${input.origin.trim() || 'To decide'}`,
    `Our household: ${input.adults} adult${input.adults === 1 ? '' : 's'}, ${input.children} child${input.children === 1 ? '' : 'ren'}`,
    input.childNotes?.trim() ? `Children's ages and lessons: ${input.childNotes.trim()}` : null,
    input.anotherFamily ? 'Another family: invited to help plan; their details are still to come.' : 'Another family: not added yet.',
    `Lodging: ${STAY_LABEL[input.stay]}`,
    input.nightlyBudget.trim() ? `Combined lodging target: $${input.nightlyBudget.trim()} per night (planning target, not a quote)` : 'Combined lodging target: to decide together',
    'Next: compare snow outlook, kid-friendly terrain, travel time, events, and stays before choosing a town.',
  ];
  return lines.filter((line): line is string => Boolean(line)).join('\n');
}

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

/** Local calendar date as YYYY-MM-DD. */
export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function validateFamilySkiInput(input: FamilySkiInput, today: string = localToday()): string | null {
  if (!Object.prototype.hasOwnProperty.call(REGION_DESTINATION, input.region) || !Object.prototype.hasOwnProperty.call(STAY_LABEL, input.stay)) return 'Choose a ski region and lodging priority.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start) || !/^\d{4}-\d{2}-\d{2}$/.test(input.end)) return 'Choose your travel dates.';
  if (!Number.isFinite(Date.parse(`${input.start}T00:00:00Z`)) || !Number.isFinite(Date.parse(`${input.end}T00:00:00Z`))) return 'Choose your travel dates.';
  if (input.start < today) return 'Choose a first day from today onward.';
  if (input.end < input.start) return 'Choose an end date on or after the start date.';
  if (dayNumber(input.end) - dayNumber(input.start) > MAX_TRIP_DAYS) return `Keep the trip to ${MAX_TRIP_DAYS} days or fewer.`;
  if (!Number.isInteger(input.adults) || input.adults < 1 || input.adults > 16) return 'Enter between 1 and 16 adults.';
  if (!Number.isInteger(input.children) || input.children < 0 || input.children > 16) return 'Enter between 0 and 16 children.';
  if (input.adults + input.children > 25) return 'Enter no more than 25 travelers in your household.';
  if (input.nightlyBudget && (!/^\d+$/.test(input.nightlyBudget) || Number(input.nightlyBudget) > 100000)) return 'Enter a whole-dollar lodging budget, or leave it blank.';
  if ((input.resorts?.length ?? 0) > 160 || (input.childNotes?.length ?? 0) > 200) return 'Shorten the resort list or children notes.';
  return null;
}

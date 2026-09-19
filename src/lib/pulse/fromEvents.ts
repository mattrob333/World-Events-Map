import type { EventCategory, WorldEvent } from '@/lib/types';
import { scoreEvent } from '@/lib/buzz/scoring';
import { daysBetween, todayISO } from '@/lib/buzz/dates';
import type {
  DestinationArchetype,
  DestinationPulse,
  ProvenanceKind,
  PulseReason,
  PulseStatus,
  SignalFact,
  WeatherContext,
} from './types';

const CATEGORY_ARCHETYPE: Record<EventCategory, DestinationArchetype> = {
  ski: 'ski',
  sailing: 'sailing',
  motorsport: 'motorsport',
  culinary: 'food',
  music: 'nightlife',
  gala: 'nightlife',
  wellness: 'wellness',
  safari: 'nature',
  nature: 'nature',
  cultural: 'culture',
  art: 'culture',
  film: 'culture',
  design: 'culture',
  fashion: 'culture',
  golf: 'culture',
  tennis: 'culture',
  equestrian: 'culture',
};

export function slugifyPlace(city: string): string {
  return city
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function destinationKey(event: WorldEvent): string {
  return `${event.city.toLowerCase()}|${event.countryCode}`;
}

function uniqueSlug(city: string, countryCode: string, used: Set<string>): string {
  const base = slugifyPlace(city) || countryCode.toLowerCase();
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  const withCountry = `${base}-${countryCode.toLowerCase()}`;
  if (!used.has(withCountry)) {
    used.add(withCountry);
    return withCountry;
  }
  let n = 2;
  while (used.has(`${withCountry}-${n}`)) n += 1;
  const slug = `${withCountry}-${n}`;
  used.add(slug);
  return slug;
}

function fact(
  label: string,
  value: number,
  provenance: ProvenanceKind,
  note: string,
  direction: SignalFact['direction'] = 'flat',
): SignalFact {
  return {
    value,
    label,
    direction,
    provenance,
    freshness: 'calendar',
    note,
  };
}

function velocityDirection(v: number): SignalFact['direction'] {
  if (v > 0.08) return 'up';
  if (v < -0.08) return 'down';
  return 'flat';
}

function statusFor(args: {
  inWindow: boolean;
  daysToLead: number | null;
  trend: number;
  seasonal: boolean;
}): PulseStatus {
  if (args.inWindow) return 'live';
  if (args.daysToLead != null && args.daysToLead <= 45 && args.trend >= 0) {
    return 'heating_up';
  }
  if (args.trend < -0.08) return 'cooling';
  if (args.seasonal) return 'seasonal';
  return 'steady';
}

function whyNow(reasons: PulseReason[], name: string): string {
  if (reasons.length === 0) {
    return `${name} is on the MERIDIAN calendar. Demand figures are modeled from curated event signals, not a crowd count.`;
  }
  const lead = reasons.slice(0, 3).map((r) => r.text);
  if (lead.length === 1) return `${lead[0]}.`;
  if (lead.length === 2) return `${lead[0]}, and ${lead[1].charAt(0).toLowerCase()}${lead[1].slice(1)}.`;
  return `${lead[0]}; ${lead[1].charAt(0).toLowerCase()}${lead[1].slice(1)}; ${lead[2].charAt(0).toLowerCase()}${lead[2].slice(1)}.`;
}

function seasonalContext(archetypes: DestinationArchetype[], lead: WorldEvent): WeatherContext {
  const month = Number(lead.start.slice(5, 7));
  if (archetypes.includes('ski')) {
    return {
      destinationId: '',
      seasonLabel: month >= 11 || month <= 3 ? 'Ski season' : 'Off-piste shoulder',
      windowLabel: `${lead.start} → ${lead.end}`,
      note: 'Season label is inferred from the curated ski calendar, not a live snow report.',
      provenance: 'seasonal_calendar',
    };
  }
  if (archetypes.includes('sailing') || archetypes.includes('beach')) {
    return {
      destinationId: '',
      seasonLabel: 'On-water season',
      windowLabel: `${lead.start} → ${lead.end}`,
      note: 'Season label follows the event calendar for this destination, not a marine forecast.',
      provenance: 'seasonal_calendar',
    };
  }
  return {
    destinationId: '',
    seasonLabel: 'In-season window',
    windowLabel: `${lead.start} → ${lead.end}`,
    note: 'Window taken from curated event dates.',
    provenance: 'seasonal_calendar',
  };
}

export function buildDestinationPulses(
  events: WorldEvent[],
  now: string = todayISO(),
  options: { signalFreshness?: string | null } = {},
): DestinationPulse[] {
  const groups = new Map<string, WorldEvent[]>();
  for (const event of events) {
    const key = destinationKey(event);
    const list = groups.get(key);
    if (list) list.push(event);
    else groups.set(key, [event]);
  }

  const usedSlugs = new Set<string>();
  const pulses: DestinationPulse[] = [];
  const demandProvenance: ProvenanceKind = options.signalFreshness
    ? 'updated_signals'
    : 'modeled_demand';

  for (const [, group] of groups) {
    const sorted = [...group].sort((a, b) => {
      const aLive = a.start <= now && a.end >= now ? 0 : 1;
      const bLive = b.start <= now && b.end >= now ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      const aFuture = a.end >= now ? 0 : 1;
      const bFuture = b.end >= now ? 0 : 1;
      if (aFuture !== bFuture) return aFuture - bFuture;
      return a.start < b.start ? -1 : a.start > b.start ? 1 : a.id.localeCompare(b.id);
    });
    const lead = sorted[0];
    if (!lead) continue;

    const scored = sorted.map((event) => ({
      event,
      buzz: scoreEvent(event, { now: event.start <= now && event.end >= now ? now : event.start }),
    }));
    scored.sort((a, b) => b.buzz.score - a.buzz.score);
    const hottest = scored[0]!;
    const inWindow = sorted.some((event) => event.start <= now && event.end >= now);
    const upcoming = sorted.find((event) => event.end >= now) ?? lead;
    const daysToLead = upcoming.end >= now ? Math.max(0, daysBetween(now, upcoming.start)) : null;
    const trend =
      hottest.event.signals.socialVelocity * 0.6 +
      (hottest.event.signals.bookingPressure - 0.5) * 0.4;
    const archetypes = [
      ...new Set(sorted.map((event) => CATEGORY_ARCHETYPE[event.category])),
    ];
    const seasonal = sorted.some((event) => event.recurrence === 'seasonal');
    const status = statusFor({
      inWindow,
      daysToLead,
      trend,
      seasonal,
    });

    const reasons: PulseReason[] = [];
    const search = hottest.event.signals.searchInterest;
    const booking = hottest.event.signals.bookingPressure;
    const velocity = hottest.event.signals.socialVelocity;
    const inSeasonCount = sorted.filter((event) => event.start <= now && event.end >= now).length;
    const upcomingCount = sorted.filter(
      (event) => event.start > now && daysBetween(now, event.start) <= 60,
    ).length;

    if (inSeasonCount > 0) {
      reasons.push({
        id: 'in-window',
        text: `${inSeasonCount} curated ${inSeasonCount === 1 ? 'occasion is' : 'occasions are'} in dates right now`,
        weight: 1,
        provenance: 'curated_calendar',
      });
    } else if (upcomingCount > 0) {
      reasons.push({
        id: 'upcoming',
        text: `${upcomingCount} curated ${upcomingCount === 1 ? 'occasion sits' : 'occasions sit'} inside the next 60 days`,
        weight: 0.9,
        provenance: 'curated_calendar',
      });
    }
    if (search >= 55) {
      reasons.push({
        id: 'search',
        text: 'Search interest is holding in the upper half of the index',
        weight: 0.8,
        provenance: demandProvenance,
      });
    }
    if (booking >= 0.75) {
      reasons.push({
        id: 'booking',
        text: 'Hotel and charter pressure is modeled as tight for the lead week',
        weight: 0.85,
        provenance: demandProvenance,
      });
    }
    if (velocity >= 0.15) {
      reasons.push({
        id: 'velocity',
        text: 'Social velocity is modeled as rising week over week',
        weight: 0.7,
        provenance: demandProvenance,
      });
    } else if (velocity <= -0.15) {
      reasons.push({
        id: 'velocity-down',
        text: 'Social velocity is modeled as cooling',
        weight: 0.4,
        provenance: demandProvenance,
      });
    }
    if (hottest.event.tier === 'legendary' || hottest.event.tier === 'marquee') {
      reasons.push({
        id: 'marquee',
        text: `${hottest.event.name} is on the board as a ${hottest.event.tier} week`,
        weight: 0.75,
        provenance: 'curated_calendar',
      });
    }

    reasons.sort((a, b) => b.weight - a.weight);

    const weather = seasonalContext(archetypes, upcoming);
    weather.destinationId = '';

    pulses.push({
      id: destinationKey(lead),
      slug: uniqueSlug(lead.city, lead.countryCode, usedSlugs),
      name: lead.city,
      country: lead.country,
      countryCode: lead.countryCode,
      coords: lead.coords,
      timezone: lead.timezone,
      score: Math.round(hottest.buzz.score),
      trend,
      status,
      archetypes,
      whyNow: whyNow(reasons, lead.city),
      reasons,
      signals: {
        events: fact(
          'Occasions on the calendar',
          sorted.length,
          'curated_calendar',
          `${sorted.length} curated events mapped to this place.`,
        ),
        social: fact(
          'Social velocity',
          Math.round((velocity + 1) * 50),
          demandProvenance,
          'Week-over-week mention change from the buzz model, not a live count.',
          velocityDirection(velocity),
        ),
        search: fact(
          'Search interest',
          search,
          demandProvenance,
          'Relative search index (0–100) used by the buzz model.',
          search >= 60 ? 'up' : search <= 30 ? 'down' : 'flat',
        ),
        booking: fact(
          'Booking pressure',
          Math.round(booking * 100),
          demandProvenance,
          'Modeled hotel/charter scarcity for the lead week, not live inventory.',
          booking >= 0.7 ? 'up' : booking <= 0.35 ? 'down' : 'flat',
        ),
        weather: fact(
          weather.seasonLabel,
          status === 'live' || status === 'heating_up' ? 80 : 45,
          'seasonal_calendar',
          weather.note,
        ),
      },
      eventIds: sorted.map((event) => event.id),
      leadEventId: hottest.event.id,
      updatedAt: options.signalFreshness ?? `${now}T00:00:00.000Z`,
    });
  }

  pulses.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return pulses;
}

export function getDestinationBySlug(
  events: WorldEvent[],
  slug: string,
  now?: string,
  options?: { signalFreshness?: string | null },
): DestinationPulse | undefined {
  return buildDestinationPulses(events, now, options).find((pulse) => pulse.slug === slug);
}

export function getDestinationByEventId(
  events: WorldEvent[],
  eventId: string,
  now?: string,
): DestinationPulse | undefined {
  return buildDestinationPulses(events, now).find((pulse) => pulse.eventIds.includes(eventId));
}

export function indexDestinations(
  events: WorldEvent[],
  now?: string,
  options?: { signalFreshness?: string | null },
): {
  pulses: DestinationPulse[];
  bySlug: Map<string, DestinationPulse>;
  byEventId: Map<string, DestinationPulse>;
} {
  const pulses = buildDestinationPulses(events, now, options);
  const bySlug = new Map(pulses.map((pulse) => [pulse.slug, pulse]));
  const byEventId = new Map<string, DestinationPulse>();
  for (const pulse of pulses) {
    for (const eventId of pulse.eventIds) byEventId.set(eventId, pulse);
  }
  return { pulses, bySlug, byEventId };
}

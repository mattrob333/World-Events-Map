import { bookingAlertFor, type BookingUrgency } from '@/lib/alerts/engine';
import { daysBetween } from '@/lib/buzz/dates';
import type { WorldEvent } from '@/lib/types';

export type WhyNowTone = 'now' | 'soon' | 'plan' | 'later';

export interface PlanBy {
  urgency: BookingUrgency;
  /** ISO date by which to commit, from the editorial booking window */
  deadline: string;
  label: string;
}

export interface WhyNow {
  tone: WhyNowTone;
  /** "On now · till Sep 27", "Starts in 5 days", "In 6 weeks" */
  when: string;
  /** When the scarce part of the trip usually goes. Editorial, never live availability. */
  planBy?: PlanBy;
  /** The event's own first reason to go */
  reason?: string;
}

/** Plan-by markers further out than this read as noise, not a heads-up. */
export const PLAN_BY_HORIZON_DAYS = 75;

export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function whenLine(event: WorldEvent, today: string): { tone: WhyNowTone; when: string } {
  if (event.start <= today && event.end >= today) {
    return { tone: 'now', when: event.end === today ? 'Last day today' : `On now · till ${shortDate(event.end)}` };
  }
  const days = daysBetween(today, event.start);
  if (days <= 0) return { tone: 'now', when: 'Starts today' };
  if (days === 1) return { tone: 'soon', when: 'Starts tomorrow' };
  if (days <= 13) return { tone: 'soon', when: `Starts in ${days} days` };
  if (days <= 60) return { tone: 'plan', when: `In ${Math.round(days / 7)} weeks · ${shortDate(event.start)}` };
  return { tone: 'later', when: shortDate(event.start) };
}

function planByLine(event: WorldEvent, today: string): PlanBy | undefined {
  const alert = bookingAlertFor(event, today);
  const base = { urgency: alert.urgency, deadline: alert.deadline };
  switch (alert.urgency) {
    case 'critical':
      return { ...base, label: alert.daysToDeadline <= 0 ? 'Last call: plan today' : `Last call · plan by ${shortDate(alert.deadline)}` };
    case 'closing':
      return { ...base, label: `Plan by ${shortDate(alert.deadline)}` };
    case 'open':
      return alert.daysToDeadline <= PLAN_BY_HORIZON_DAYS ? { ...base, label: `Plan by ${shortDate(alert.deadline)}` } : undefined;
    // Past the window, a plan-by date is no longer a heads-up; the timing line says enough.
    case 'passed':
    case 'underway':
      return undefined;
  }
}

/**
 * Why this place, why now: the timing against today, the editorial plan-by
 * date (when the scarce part of the trip usually goes, see lib/alerts), and
 * the event's own first reason. Pure; `today` is passed in.
 */
export function whyNow(event: WorldEvent, today: string): WhyNow {
  const { tone, when } = whenLine(event, today);
  return { tone, when, planBy: tone === 'now' ? undefined : planByLine(event, today), reason: event.whyGo[0] };
}

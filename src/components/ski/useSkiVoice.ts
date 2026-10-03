'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { interestWeights, rankRanges, rankResorts } from '@/lib/ski/match';
import { useSkiPlan } from '@/lib/ski/store';
import { findByName, rangeNames, resortNames, windowFromArgs } from '@/lib/ski/voice';
import { formatSpan } from '@/lib/ski/window';
import { glow } from '@/lib/voice/glow';
import { useVoicePage } from '@/lib/voice/registry';
import type { SkiContext } from './common';

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const list = (names: string[]) => names.join(', ');

/**
 * What the sun can do on any ski page: set the dates and who's coming,
 * shortlist ranges and resorts by name, open one, or open the trip to share.
 * Each change lights up on the page (lib/voice/glow.ts), and each reply names
 * what's on screen so the voice can keep going from it.
 */
export function useSkiVoice(context: SkiContext | null, here: { rangeId?: string } = {}) {
  const router = useRouter();
  const loading = 'Error: the ski planner is still loading. Try again in a moment.';
  // The page registers before its data is in; a tool that arrives first waits for it (up to 5 seconds).
  const latest = useRef(context);
  useEffect(() => { latest.current = context; });
  const ready = async (): Promise<SkiContext | null> => {
    for (let tries = 0; !latest.current && tries < 50; tries++) await new Promise((resolve) => window.setTimeout(resolve, 100));
    return latest.current;
  };

  useVoicePage(
    'ski',
    {
      ski_set_window: async (args) => {
        const context = await ready();
        if (!context) return loading;
        const plan = useSkiPlan.getState();
        const said = args.from !== undefined || args.to !== undefined || args.nights !== undefined;
        let window = context.window;
        if (said) {
          const next = windowFromArgs(window, args, localToday());
          if ('error' in next) return next.error;
          window = next;
          plan.setWindow(next);
        }
        const party = args.party === 'family' || args.party === 'crew' ? args.party : null;
        if (party) plan.setParty(party);
        if (!said && !party) return 'Error: say when they could go, for how long, or who is coming.';
        glow('ski:window');
        // Weighed for who's coming now, not the party of the last render.
        const weights = party ? interestWeights(context.signals, party) : context.weights;
        const top = rankRanges(context.data.ranges, context.data.resorts, context.data.scene, window, weights).slice(0, 4).map((match) => match.range.name);
        return `Set: ${formatSpan(window.from, window.to)}, ${window.nights} nights, ${(party ?? plan.party) === 'family' ? 'with kids' : 'adults'}. Best ranges for that: ${list(top)}.`;
      },
      ski_shortlist: async (args) => {
        const context = await ready();
        if (!context) return loading;
        const names = (Array.isArray(args.names) ? args.names : []).filter((name): name is string => typeof name === 'string').slice(0, 6);
        if (!names.length) return 'Error: which ones?';
        const remove = args.remove === true;
        const { picks, togglePick } = useSkiPlan.getState();
        const { data } = context;
        const level = args.level === 'resort' ? 'resort' : 'range';
        const found = new Map<string, string>();
        const missing: string[] = [];
        for (const name of names) {
          const hits = level === 'range'
            ? findByName(data.ranges, name, rangeNames).map((range) => [range.id, range.name] as const)
            : // The range on screen first, so "Vail" there means the one in view.
              (here.rangeId ? findByName(data.resorts.filter((resort) => resort.rangeId === here.rangeId), name, resortNames) : [])
                .concat(findByName(data.resorts, name, resortNames))
                .slice(0, 4)
                .map((resort) => [resort.id, resort.name] as const);
          if (!hits.length) missing.push(name);
          for (const [id, label] of hits) found.set(id, label);
        }
        if (!found.size) {
          const options = level === 'range' ? data.ranges.map((range) => range.name) : here.rangeId ? data.resorts.filter((resort) => resort.rangeId === here.rangeId).map((resort) => resort.name) : [];
          return `Error: no ${level} called ${list(missing)}.${options.length ? ` Options: ${list(options)}.` : ''}`;
        }
        for (const id of found.keys()) {
          if (picks[level].includes(id) === remove) togglePick(level, id);
        }
        glow(...[...found.keys()].map((id) => `ski:${level}:${id}`), 'ski:bar');
        // Resorts all in one other range: open it, so they see them light up.
        if (level === 'resort' && !remove) {
          const ranges = new Set([...found.keys()].map((id) => data.resortById.get(id)?.rangeId));
          const [only] = [...ranges];
          if (ranges.size === 1 && only && only !== here.rangeId) router.push(`/ski/${only}`);
        }
        const done = `${remove ? 'Off' : 'On'} their list: ${list([...found.values()])}.`;
        return missing.length ? `${done} Couldn’t find ${list(missing)}.` : done;
      },
      ski_open: async (args) => {
        const context = await ready();
        if (!context) return loading;
        const { data } = context;
        if (typeof args.resort === 'string' && args.resort.trim()) {
          const [resort] = findByName(data.resorts, args.resort, resortNames);
          if (!resort) return `Error: no resort called ${args.resort}.`;
          router.push(`/ski/resort/${resort.id}`);
          return `Opened ${resort.name}: its best weeks for their dates and what is on around it.`;
        }
        if (typeof args.range === 'string' && args.range.trim()) {
          const [range] = findByName(data.ranges, args.range, rangeNames);
          if (!range) return `Error: no range called ${args.range}. Ranges: ${list(data.ranges.map((entry) => entry.name))}.`;
          router.push(`/ski/${range.id}`);
          const top = rankResorts(data.resorts.filter((resort) => resort.rangeId === range.id), data.scene, context.window, context.weights).slice(0, 5).map((match) => match.resort.name);
          return `Opened ${range.name}. Resorts there, best for them first: ${list(top)}.`;
        }
        return 'Error: which range or resort?';
      },
      ski_share: () => {
        const { picks } = useSkiPlan.getState();
        if (!picks.range.length && !picks.resort.length && !picks.week.length) return 'Error: their shortlist is empty. Shortlist a range or a resort first.';
        router.push('/ski/trip');
        glow('ski:share');
        return 'Opened their trip. They tap Share to vote to send it; the phone needs their tap.';
      },
    },
    () => {
      if (!context) return 'The ski planner is loading.';
      const { data, window } = context;
      const { picks, party } = useSkiPlan.getState();
      const names = (ids: string[], get: (id: string) => string | undefined) => ids.map(get).filter(Boolean).join(', ');
      const shortlist = [names(picks.range, (id) => data.rangeById.get(id)?.name), names(picks.resort, (id) => data.resortById.get(id)?.name)].filter(Boolean).join('; ');
      const range = here.rangeId ? data.rangeById.get(here.rangeId) : undefined;
      const view = range
        ? `Looking at ${range.name}: ${data.resorts.filter((resort) => resort.rangeId === range.id).map((resort) => resort.name).slice(0, 12).join(', ')}.`
        : `Ranges: ${data.ranges.map((entry) => entry.name).join(', ')}.`;
      return `Ski planner. ${formatSpan(window.from, window.to)}, ${window.nights} nights, ${party === 'family' ? 'with kids' : 'adults'}. ${shortlist ? `Shortlist: ${shortlist}.` : 'Nothing shortlisted yet.'} ${view}`;
    },
  );
}

import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  slotKindForBlock,
  travelMinutes,
  type PickKind,
  type ScheduleInput,
  type SchedulePick,
  type ScheduleResult,
} from './schedule';

// 2026-10-05 is a Monday; 2026-10-09 a Friday.
const MONDAY = '2026-10-05';
const FRIDAY = '2026-10-09';

// Two neighbourhoods of a Lisbon-sized city, ~7 km apart.
const DOWNTOWN = { lat: 38.7110, lng: -9.1370 };
const BELEM = { lat: 38.6930, lng: -9.2150 };

const near = (base: { lat: number; lng: number }, dLat: number, dLng: number) => ({
  lat: base.lat + dLat,
  lng: base.lng + dLng,
});

const base = (picks: SchedulePick[], extra: Partial<ScheduleInput> = {}): ScheduleInput => ({
  startDate: MONDAY,
  days: 1,
  pace: 'balanced',
  picks,
  ...extra,
});

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Absolute minutes on the day axis for each block (unwraps blocks after midnight). */
function timeline(day: ScheduleResult['days'][number]) {
  let lastStart = -1;
  return day.blocks.map((b) => {
    let start = toMin(b.start);
    if (start < lastStart) start += 1440;
    lastStart = start;
    let end = toMin(b.end);
    while (end <= start) end += 1440;
    return { ...b, s: start, e: end };
  });
}

function allBlocks(result: ScheduleResult) {
  return result.days.flatMap((d) => timeline(d).map((b) => ({ ...b, date: d.date })));
}

/** Deterministic LCG so the property fixtures never change between runs. */
function lcg(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const KINDS: PickKind[] = ['breakfast', 'lunch', 'dinner', 'drinks', 'nightlife', 'sight', 'activity', 'event'];

function randomFixture(seed: number): ScheduleInput {
  const rnd = lcg(seed);
  const days = 1 + Math.floor(rnd() * 5);
  const picks: SchedulePick[] = [];
  const count = 6 + Math.floor(rnd() * 20);
  for (let i = 0; i < count; i++) {
    const kind = KINDS[Math.floor(rnd() * KINDS.length)];
    const pick: SchedulePick = { id: `p${i}`, name: `Place ${i}`, kind, priority: 1 + Math.floor(rnd() * 5) };
    if (rnd() < 0.8) {
      pick.lat = DOWNTOWN.lat + (rnd() - 0.5) * 0.12;
      pick.lng = DOWNTOWN.lng + (rnd() - 0.5) * 0.16;
    }
    if (rnd() < 0.3) pick.durationMin = 30 + Math.floor(rnd() * 150);
    if (rnd() < 0.3) {
      const open = 8 + Math.floor(rnd() * 12);
      const close = (open + 3 + Math.floor(rnd() * 10)) % 24;
      const range = `${String(open).padStart(2, '0')}:00-${String(close).padStart(2, '0')}:30`;
      pick.hours = { 1: [range], 3: [range], 5: [range], 6: [range] };
    }
    if (rnd() < 0.25) pick.busyByHour = Array.from({ length: 24 }, () => Math.floor(rnd() * 100));
    if (kind === 'event' && rnd() < 0.6) {
      const day = Math.floor(rnd() * (days + 1));
      const hour = 10 + Math.floor(rnd() * 12);
      const date = new Date(Date.UTC(2026, 9, 5 + day, 12)).toISOString().slice(0, 10);
      pick.fixedStart = `${date}T${String(hour).padStart(2, '0')}:00`;
    }
    picks.push(pick);
  }
  return {
    startDate: MONDAY,
    days,
    picks,
    pace: (['easy', 'balanced', 'packed'] as const)[Math.floor(rnd() * 3)],
    lodging: rnd() < 0.5 ? DOWNTOWN : undefined,
  };
}

describe('buildSchedule', () => {
  it('is deterministic and does not mutate its input', () => {
    const input = randomFixture(42);
    const snapshot = JSON.stringify(input);
    const a = JSON.stringify(buildSchedule(input));
    const b = JSON.stringify(buildSchedule(JSON.parse(snapshot) as ScheduleInput));
    expect(a).toBe(b);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('keeps meals inside their windows and at most one of each per day', () => {
    const picks: SchedulePick[] = [
      { id: 'b1', name: 'Pastry', kind: 'breakfast' },
      { id: 'l1', name: 'Tasca', kind: 'lunch' },
      { id: 'l2', name: 'Other tasca', kind: 'lunch' },
      { id: 'l3', name: 'Third tasca', kind: 'lunch' },
      { id: 'd1', name: 'Bistro', kind: 'dinner' },
      { id: 'd2', name: 'Grill', kind: 'dinner' },
      { id: 'r1', name: 'Wine bar', kind: 'drinks' },
      { id: 'n1', name: 'Club', kind: 'nightlife' },
    ];
    const result = buildSchedule(base(picks, { days: 2 }));
    const windows: Record<string, [number, number]> = {
      breakfast: [450, 630],
      lunch: [690, 870],
      dinner: [1110, 1320],
      drinks: [1020, 1200],
      nightlife: [1290, 1620],
    };
    for (const day of result.days) {
      const blocks = timeline(day);
      for (const kind of Object.keys(windows)) {
        expect(blocks.filter((b) => b.kind === kind).length).toBeLessThanOrEqual(1);
      }
      for (const b of blocks) {
        const [lo, hi] = windows[b.kind];
        expect(b.s).toBeGreaterThanOrEqual(lo);
        expect(b.e).toBeLessThanOrEqual(hi);
      }
    }
    expect(result.days[0].blocks.find((b) => b.kind === 'lunch')?.start).toBe('12:30');
    expect(result.days[0].blocks.find((b) => b.kind === 'lunch')?.reason).toBe('Classic lunch time');
    expect(result.unscheduled).toEqual([{ pickId: 'l3', reason: 'Every day already has a lunch stop' }]);
  });

  it('limits activity blocks per day by pace and explains the overflow', () => {
    const sights: SchedulePick[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      name: `Sight ${i}`,
      kind: 'sight',
      ...near(DOWNTOWN, i * 0.001, 0),
    }));
    const easy = buildSchedule(base(sights, { days: 2, pace: 'easy' }));
    for (const day of easy.days) expect(day.blocks.length).toBeLessThanOrEqual(2);
    expect(easy.score.placed).toBe(4);
    expect(easy.unscheduled).toHaveLength(4);
    for (const u of easy.unscheduled) expect(u.reason).toBe('Day full at this pace');

    const packed = buildSchedule(base(sights, { days: 2, pace: 'packed' }));
    expect(packed.score.placed).toBe(8);
    for (const day of packed.days) expect(day.blocks.length).toBeLessThanOrEqual(5);
  });

  it('places fixed events at their exact start and rejects out-of-range or invalid ones', () => {
    const result = buildSchedule(base([
      { id: 'fado', name: 'Fado night', kind: 'event', fixedStart: '2026-10-06T21:15', durationMin: 120 },
      { id: 'early', name: 'Before trip', kind: 'event', fixedStart: '2026-10-04T20:00' },
      { id: 'late', name: 'After trip', kind: 'event', fixedStart: '2026-10-08T20:00' },
      { id: 'bad', name: 'Garbled', kind: 'event', fixedStart: '2026-10-06 25:00' },
      { id: 'clash', name: 'Same time', kind: 'event', fixedStart: '2026-10-06T22:00' },
    ], { days: 2 }));
    const fado = result.days[1].blocks.find((b) => b.pickId === 'fado');
    expect(fado).toMatchObject({ start: '21:15', end: '23:15', reason: 'Fixed event time' });
    expect(result.unscheduled).toEqual([
      { pickId: 'early', reason: 'Event date is outside the trip dates' },
      { pickId: 'late', reason: 'Event date is outside the trip dates' },
      { pickId: 'bad', reason: 'Fixed start time is not a valid local date and time' },
      { pickId: 'clash', reason: 'Clashes with fixed-time "Fado night"' },
    ]);
  });

  it('honours weekday opening hours', () => {
    // Monday trip start; the museum only opens Wednesday 10:00-12:00.
    const result = buildSchedule(base([
      { id: 'm', name: 'Museum', kind: 'sight', hours: { 3: ['10:00-12:00'] } },
    ], { days: 3 }));
    expect(result.days[0].blocks).toHaveLength(0);
    expect(result.days[1].blocks).toHaveLength(0);
    expect(result.days[2].blocks).toEqual([
      expect.objectContaining({ pickId: 'm', start: '10:00', end: '11:30', reason: 'Fits its opening hours' }),
    ]);
  });

  it('honours opening hours that cross midnight', () => {
    // Friday + Saturday; the club is only open Saturday night into Sunday.
    const result = buildSchedule(base([
      { id: 'club', name: 'Lux', kind: 'nightlife', hours: { 6: ['23:00-03:00'] } },
      { id: 'bar', name: 'Late bar', kind: 'nightlife', hours: { 5: ['00:00-01:00'], 6: ['00:00-02:00'] } },
    ], { startDate: FRIDAY, days: 2 }));
    expect(result.days[0].blocks).toEqual([]);
    const sat = timeline(result.days[1]);
    expect(sat.map((b) => [b.pickId, b.start, b.end])).toEqual([['club', '23:00', '01:30']]);
    expect(sat[0].e).toBeLessThanOrEqual(1440 + 180);
    // The 00:00-02:00 window on Saturday/Sunday mornings is too short for a 150 minute block.
    expect(result.unscheduled).toEqual([{ pickId: 'bar', reason: 'No opening hours fit on these days' }]);
  });

  it('uses the next weekday\'s early-morning window for late plans', () => {
    // Friday 22:00-24:00 plus Saturday 00:00-02:00 together fit a 3 hour night out.
    const result = buildSchedule(base([
      { id: 'n', name: 'Split hours', kind: 'nightlife', durationMin: 180, hours: { 5: ['22:00-24:00'], 6: ['00:00-02:00'] } },
    ], { startDate: FRIDAY }));
    expect(result.days[0].blocks[0]).toMatchObject({ start: '22:30', end: '01:30' });
  });

  it('reports picks that are never open on the trip days', () => {
    const result = buildSchedule(base([
      { id: 'sun', name: 'Sunday market', kind: 'sight', hours: { 0: ['08:00-13:00'] } },
    ], { days: 3 }));
    expect(result.unscheduled).toEqual([{ pickId: 'sun', reason: 'No opening hours fit on these days' }]);
    expect(result.score).toMatchObject({ placed: 0, total: 1 });
  });

  it('picks the quietest hour when busyness data exists', () => {
    const busy = Array.from({ length: 24 }, (_, h) => (h === 16 || h === 17 ? 5 : 90));
    const result = buildSchedule(base([
      { id: 'q', name: 'Popular gallery', kind: 'sight', busyByHour: busy },
    ]));
    expect(result.days[0].blocks[0]).toMatchObject({
      start: '16:00',
      end: '17:30',
      reason: 'Quietest time in its window per busy data',
    });
  });

  it('breaks busyness ties by the earliest start', () => {
    const result = buildSchedule(base([
      { id: 'q', name: 'Flat', kind: 'sight', busyByHour: Array(24).fill(40) },
    ]));
    expect(result.days[0].blocks[0].start).toBe('09:00');
  });

  it('clusters nearby picks on the same day', () => {
    const picks: SchedulePick[] = [
      { id: 'd1', name: 'Castle', kind: 'sight', priority: 5, ...near(DOWNTOWN, 0.002, 0.003) },
      { id: 'b1', name: 'Monastery', kind: 'sight', priority: 4, ...BELEM },
      { id: 'd2', name: 'Cathedral', kind: 'sight', ...near(DOWNTOWN, -0.002, 0.001) },
      { id: 'b2', name: 'Tower', kind: 'activity', ...near(BELEM, -0.003, -0.004) },
    ];
    const result = buildSchedule(base(picks, { days: 2 }));
    const dayOf = (id: string) => result.days.findIndex((d) => d.blocks.some((b) => b.pickId === id));
    expect(dayOf('d1')).toBe(dayOf('d2'));
    expect(dayOf('b1')).toBe(dayOf('b2'));
    expect(dayOf('d1')).not.toBe(dayOf('b1'));
    // Highest priority seeds the first day.
    expect(dayOf('d1')).toBe(0);
  });

  it('orders stops nearest-first from lodging and counts travel', () => {
    const lodging = DOWNTOWN;
    const picks: SchedulePick[] = [
      { id: 'far', name: 'Far', kind: 'sight', priority: 5, ...near(DOWNTOWN, 0.03, 0) },
      { id: 'close', name: 'Close', kind: 'sight', ...near(DOWNTOWN, 0.005, 0) },
    ];
    const result = buildSchedule(base(picks, { lodging }));
    const blocks = result.days[0].blocks;
    expect(blocks.map((b) => b.pickId)).toEqual(['close', 'far']);
    expect(blocks[0].travelMinBefore).toBe(travelMinutes(lodging, near(DOWNTOWN, 0.005, 0)));
    expect(blocks[0].start).toBe('09:10');
    expect(blocks[1].travelMinBefore).toBe(10);
    expect(toMin(blocks[1].start)).toBeGreaterThanOrEqual(toMin(blocks[0].end) + 10);
    expect(blocks[1].reason).toBe('Near Close (10 min away)');
    expect(result.score.travelMin).toBe(20);
  });

  it('computes travel minutes with rounding, minimums and unknown locations', () => {
    expect(travelMinutes(DOWNTOWN, DOWNTOWN)).toBe(0);
    expect(travelMinutes(DOWNTOWN, near(DOWNTOWN, 0.0018, 0))).toBe(5); // ~0.2 km
    expect(travelMinutes(DOWNTOWN, near(DOWNTOWN, 0.009, 0))).toBe(10); // ~1 km -> min 10
    expect(travelMinutes(DOWNTOWN, near(DOWNTOWN, 0.054, 0))).toBe(25); // ~6 km at 18 km/h = 20 min, ceil to 25
    expect(travelMinutes(DOWNTOWN, near(DOWNTOWN, 0.054, 0), 36)).toBe(15);
    expect(travelMinutes(DOWNTOWN, null)).toBe(20);
    expect(travelMinutes(null, null)).toBe(20);

    const result = buildSchedule(base([
      { id: 'a', name: 'Known', kind: 'sight', priority: 5, ...DOWNTOWN },
      { id: 'b', name: 'Unknown', kind: 'sight' },
    ]));
    const [first, second] = result.days[0].blocks;
    expect(first).toMatchObject({ pickId: 'a', travelMinBefore: 0, travelKnown: true, start: '09:00' });
    // A leg to a place with no coordinates is a flat guess, and says so.
    expect(second).toMatchObject({ pickId: 'b', travelMinBefore: 20, travelKnown: false, start: '10:50' });
  });

  it('ignores duplicate ids and keeps the first', () => {
    const result = buildSchedule(base([
      { id: 'x', name: 'First', kind: 'sight' },
      { id: 'x', name: 'Second', kind: 'activity' },
      { id: 'y', name: 'Other', kind: 'sight' },
    ]));
    const names = result.days[0].blocks.map((b) => b.name);
    expect(names).toContain('First');
    expect(names).not.toContain('Second');
    expect(result.score).toMatchObject({ placed: 2, total: 2 });
  });

  it('clamps days to 1..14 and validates the start date', () => {
    expect(buildSchedule(base([], { days: 0 })).days).toHaveLength(1);
    expect(buildSchedule(base([], { days: -3 })).days).toHaveLength(1);
    expect(buildSchedule(base([], { days: Number.NaN })).days).toHaveLength(1);
    const long = buildSchedule(base([], { days: 30 }));
    expect(long.days).toHaveLength(14);
    expect(long.days[13].date).toBe('2026-10-18');
    expect(buildSchedule(base([], { startDate: '2026-12-31', days: 2 })).days.map((d) => d.date))
      .toEqual(['2026-12-31', '2027-01-01']);
    expect(() => buildSchedule(base([], { startDate: '2026-02-30' }))).toThrow(TypeError);
    expect(() => buildSchedule(base([], { startDate: 'soon' }))).toThrow(TypeError);
  });

  it('never drops a pick silently and explains bad input', () => {
    const result = buildSchedule(base([
      { id: '', name: 'No id', kind: 'sight' },
      { id: 'k', name: 'Mystery', kind: 'spa' as PickKind },
      { id: 'long', name: 'Tasting menu', kind: 'lunch', durationMin: 240 },
      { id: 'ok', name: 'Fine', kind: 'sight' },
    ]));
    expect(result.unscheduled).toEqual([
      { pickId: '', reason: 'Pick has no id' },
      { pickId: 'k', reason: 'Unknown kind of place' },
      { pickId: 'long', reason: 'Longer than the lunch window (11:30–14:30)' },
    ]);
    expect(result.score).toMatchObject({ placed: 1, total: 4 });
  });

  it('reports free minutes inside the day window', () => {
    expect(buildSchedule(base([])).days[0].freeMinutes).toBe(870);
    const one = buildSchedule(base([{ id: 's', name: 'S', kind: 'sight' }]));
    expect(one.days[0].freeMinutes).toBe(780);
    const custom = buildSchedule(base([], { dayStart: '10:00', dayEnd: '18:00' }));
    expect(custom.days[0].freeMinutes).toBe(480);
  });

  it('respects custom day bounds for non-nightlife blocks', () => {
    const result = buildSchedule(base([
      { id: 'a', name: 'A', kind: 'activity' },
      { id: 'b', name: 'B', kind: 'activity' },
      { id: 'c', name: 'C', kind: 'activity' },
    ], { dayStart: '10:00', dayEnd: '15:00' }));
    // 300 minutes hold two 150-minute blocks only with no travel, and unknown coords cost 20.
    expect(result.days[0].blocks).toHaveLength(1);
    expect(result.days[0].blocks[0]).toMatchObject({ start: '10:00', end: '12:30' });
    expect(result.unscheduled.map((u) => u.reason)).toEqual([
      'No free slot fits around the other plans and travel',
      'No free slot fits around the other plans and travel',
    ]);
  });

  it('maps blocks onto designer slot kinds', () => {
    expect(slotKindForBlock({ kind: 'lunch', start: '12:30' })).toBe('lunch');
    expect(slotKindForBlock({ kind: 'drinks', start: '17:00' })).toBe('apres');
    expect(slotKindForBlock({ kind: 'sight', start: '09:10' })).toBe('morning');
    expect(slotKindForBlock({ kind: 'activity', start: '14:00' })).toBe('afternoon');
    expect(slotKindForBlock({ kind: 'event', start: '22:00' })).toBe('late');
    expect(slotKindForBlock({ kind: 'event', start: '01:00' })).toBe('late');
  });

  it('never overlaps blocks and accounts for every pick across seeded fixtures', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const input = randomFixture(seed);
      const result = buildSchedule(input);
      const again = buildSchedule(input);
      expect(JSON.stringify(again)).toBe(JSON.stringify(result));

      const blocks = allBlocks(result);
      const ids = [...blocks.map((b) => b.pickId), ...result.unscheduled.map((u) => u.pickId)];
      expect(new Set(ids).size).toBe(ids.length);
      expect(result.score.placed).toBe(blocks.length);
      expect(result.score.placed + result.unscheduled.length).toBe(result.score.total);
      expect(result.score.total).toBe(new Set(input.picks.map((p) => p.id)).size);
      expect(result.score.travelMin).toBe(blocks.reduce((sum, b) => sum + b.travelMinBefore, 0));

      const pickById = new Map(input.picks.map((p) => [p.id, p]));
      result.days.forEach((day, di) => {
        const tl = timeline(day);
        const acts = tl.filter((b) => b.kind === 'sight' || b.kind === 'activity' || b.kind === 'event');
        const fixedActs = acts.filter((b) => pickById.get(b.pickId)?.fixedStart).length;
        const limit = { easy: 2, balanced: 3, packed: 5 }[input.pace];
        expect(acts.length).toBeLessThanOrEqual(Math.max(limit, fixedActs));
        for (let i = 0; i < tl.length; i++) {
          const b = tl[i];
          const fixed = Boolean(pickById.get(b.pickId)?.fixedStart);
          if (!fixed) {
            expect(b.s).toBeGreaterThanOrEqual(540);
            if (b.kind !== 'nightlife') expect(b.e).toBeLessThanOrEqual(1410);
            else expect(b.e).toBeLessThanOrEqual(1620);
          }
          if (i > 0) {
            const prev = tl[i - 1];
            const prevFixed = Boolean(pickById.get(prev.pickId)?.fixedStart);
            expect(b.s).toBeGreaterThanOrEqual(prev.e + (fixed && prevFixed ? 0 : b.travelMinBefore));
          }
        }
        // Late plans never run into the next day's first block.
        const next = result.days[di + 1];
        if (next && tl.length && next.blocks.length) {
          const last = tl[tl.length - 1];
          expect(last.e).toBeLessThanOrEqual(1440 + toMin(next.blocks[0].start));
        }
      });
    }
  });
});

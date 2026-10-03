import { describe, expect, it } from 'vitest';
import { SKI_RANGES, SKI_RESORTS } from '@/lib/ski/data';
import { findByName, rangeNames, resortNames, skiAskFromText, windowFromArgs } from '@/lib/ski/voice';
import { backendInstructions, liveInstructions, liveSessionConfig } from './session';
import { INTENT_TOOLS, isVoiceIntent, routeFor, VOICE_TOOLS } from './tools';
import { nowWhatFrom, readAsk, vibeTarget } from './vibe';

const TODAY = '2026-10-03';

describe('Ask: the sun drives the pages', () => {
  it('routes every Ask tool to a page, except the two the sun runs itself', () => {
    expect(isVoiceIntent('vibe_go')).toBe(true);
    expect(isVoiceIntent('ski')).toBe(true);
    for (const tool of INTENT_TOOLS.vibe_go) {
      expect(VOICE_TOOLS[tool]).toBeDefined();
      if (tool === 'navigate' || tool === 'switch_profile') continue;
      expect(vibeTarget(tool, {}), tool).not.toBeNull();
    }
    expect(vibeTarget('ski_shortlist', { level: 'range', names: ['Japan'] })).toEqual({ intent: 'ski', href: '/ski' });
    expect(vibeTarget('now_filter', { what: 'drinks' })).toEqual({ intent: 'now', href: '/now' });
    expect(routeFor('ski planner')).toBe('/ski');
  });

  it('tells both halves of the voice what Ask is for, and adds no web search', () => {
    expect(liveInstructions('vibe_go', '', TODAY)).toMatch(/fills in while you talk/);
    expect(backendInstructions('vibe_go', '', TODAY)).toMatch(/ski_set_window/);
    const tools = liveSessionConfig('vibe_go', '', '', TODAY).delegation.responses.tools as { type: string; name?: string }[];
    expect(tools.some((tool) => tool.type === 'web_search')).toBe(false);
    expect(tools.map((tool) => tool.name)).toContain('now_filter');
  });

  it('reads a typed ask: skiing, right now, or a trip', () => {
    expect(readAsk('ski trip January through March with the kids')).toBe('ski');
    expect(readAsk('somewhere for a drink near me right now')).toBe('now');
    expect(readAsk('a long weekend in Lisbon in October')).toBe('trip');
    expect(nowWhatFrom('a cocktail bar')).toBe('drinks');
    expect(nowWhatFrom('I’m hungry')).toBe('food');
    expect(nowWhatFrom('live band somewhere')).toBe('music');
    expect(nowWhatFrom('anything fun')).toBe('surprise');
  });
});

describe('ski voice', () => {
  it('finds ranges and resorts by spoken name', () => {
    expect(findByName(SKI_RANGES, 'the Alps', rangeNames).map((range) => range.name)).toEqual(['French Alps', 'Swiss Alps', 'Austrian Alps', 'Italian Alps and Dolomites']);
    expect(findByName(SKI_RANGES, 'Japan', rangeNames).map((range) => range.id)).toHaveLength(1);
    expect(findByName(SKI_RANGES, 'utahs wasatch', rangeNames)[0]?.name).toBe('Utah’s Wasatch');
    expect(findByName(SKI_RANGES, 'x', rangeNames)).toEqual([]);
    expect(findByName(SKI_RANGES, 'Atlantis', rangeNames)).toEqual([]);
    const aspen = findByName(SKI_RESORTS, 'Aspen', resortNames);
    expect(aspen.length).toBeGreaterThan(0);
    expect(aspen[0]!.name).toMatch(/Aspen/);
  });

  it('sets a window from spoken dates, keeping it sane', () => {
    const current = { from: '2027-01-09', to: '2027-03-20', nights: 5 };
    expect(windowFromArgs(current, { from: '2027-01-01', to: '2027-03-31', nights: 7 }, TODAY)).toEqual({ from: '2027-01-01', to: '2027-03-31', nights: 7 });
    expect(windowFromArgs(current, { nights: 40 }, TODAY)).toMatchObject({ nights: 14 });
    // Back-by before leaving moves up to fit the stay.
    expect(windowFromArgs(current, { from: '2027-02-10', to: '2027-02-01' }, TODAY)).toEqual({ from: '2027-02-10', to: '2027-02-15', nights: 5 });
    expect(windowFromArgs(current, { from: '2027-02-30' }, TODAY)).toHaveProperty('error');
    expect(windowFromArgs(current, { from: '2025-01-01', to: '2025-02-01' }, TODAY)).toHaveProperty('error');
  });

  it('reads a typed ski ask', () => {
    expect(skiAskFromText('Ski trip January through March, me and the kids, a week', TODAY)).toEqual({ from: '2027-01-01', to: '2027-03-31', nights: 7, party: 'family' });
    expect(skiAskFromText('December to February with friends', TODAY)).toEqual({ from: '2026-12-01', to: '2027-02-28', party: 'crew' });
    expect(skiAskFromText('we may go skiing', TODAY)).toEqual({});
  });
});

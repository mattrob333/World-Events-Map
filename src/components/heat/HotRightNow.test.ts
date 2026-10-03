import { describe, expect, it } from 'vitest';
import type { HeatTicker } from '@/lib/heat/types';
import { hotItems } from './HotRightNow';

const t = (id: string) => ({ subjectId: `event:${id}` }) as HeatTicker;
const all = [t('a'), t('b'), t('c')];

describe('Hot right now: national or global', () => {
  it('shows home first, and everywhere (flagged) when too little is trending at home', () => {
    expect(hotItems({ all, byCountry: { US: [t('x'), t('y')] }, home: 'US', country: null })).toEqual({ items: [t('x'), t('y')], thinAtHome: false });
    expect(hotItems({ all, byCountry: { US: [t('x')] }, home: 'US', country: null })).toEqual({ items: all, thinAtHome: true });
    // Still loading home: nothing yet, not a flash of everywhere.
    expect(hotItems({ all, byCountry: {}, home: 'US', country: null })).toEqual({ items: [], thinAtHome: false });
  });

  it('shows everywhere or the picked country on Global', () => {
    expect(hotItems({ all, byCountry: {}, home: null, country: null }).items).toBe(all);
    expect(hotItems({ all, byCountry: { FR: [t('f')] }, home: null, country: 'FR' }).items).toEqual([t('f')]);
  });
});

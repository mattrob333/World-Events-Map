import { describe, expect, it } from 'vitest';
import { normalizeProfile } from '@/lib/designer/profile';
import { cardFromProfile, cardUrl, commonGround, decodeCard, encodeCard } from './card';

const profile = normalizeProfile({
  name: 'Matt', hometown: 'Atlanta', family: [{ relation: 'partner', label: 'Wife', name: 'Kelly' }, { relation: 'child', label: 'Son', age: 12 }],
  heritage: ['Brazilian'], interests: ['Skiing', 'Golf'], food: ['BBQ'], music: ['Jazz'], teams: ['Atlanta Braves'],
  summary: 'We travel with the boys.', style: { pace: 'balanced', budget: 'premium', lodging: [], dietary: [], avoid: [], bucketList: ['Patagonia'], languages: [] },
});

describe('travel cards', () => {
  it('carries tastes and style but never family, heritage or their own words', () => {
    const card = cardFromProfile(profile, 'Family', new Date('2026-09-26T00:00:00Z'));
    expect(card).toMatchObject({ name: 'Matt', hometown: 'Atlanta', teams: ['Atlanta Braves'], style: ['Balanced pace', 'Premium'], bucketList: ['Patagonia'] });
    expect(card.loves).toEqual(expect.arrayContaining(['Skiing', 'Golf', 'BBQ']));
    const text = JSON.stringify(card);
    for (const secret of ['Kelly', '12', 'Brazilian', 'the boys']) expect(text).not.toContain(secret);
  });

  it('round-trips through a link, and rejects junk', () => {
    const card = cardFromProfile(profile, 'Family');
    const url = cardUrl('https://dope.travel/', card);
    expect(url.startsWith('https://dope.travel/people/card#c=')).toBe(true);
    expect(decodeCard(url.split('#c=')[1])).toEqual(card);
    expect(decodeCard('not base64!')).toBeNull();
    expect(decodeCard(encodeCard({ ...card, v: 2 } as never))).toBeNull();
  });

  it('cleans what it decodes', () => {
    const crafted = btoa(JSON.stringify({ v: 1, name: '<img src=x onerror=alert(1)>Sam', loves: ['a'.repeat(500), 42, 'Jazz'], sentAt: 'soon' })).replace(/=+$/, '');
    const card = decodeCard(crafted)!;
    expect(card.name).not.toContain('<');
    expect(card.loves).toEqual(['a'.repeat(60), 'Jazz']);
    expect(card.sentAt).toBe(new Date(0).toISOString());
  });

  it('finds common ground', () => {
    const mine = cardFromProfile(profile, 'Me');
    const theirs = { ...mine, name: 'Sam', loves: ['bbq', 'Surfing'], music: ['Jazz'], teams: [], bucketList: ['Patagonia'] };
    expect(commonGround(mine, theirs)).toEqual(['BBQ', 'Jazz', 'Patagonia']);
  });
});

/**
 * Trips to anywhere: a typed-in place gets idea cards built from live
 * searches (Google Maps, YouTube, Instagram), personalized with the group's
 * food and music. No venue is invented; every card opens a real search.
 */

import type { DesignerCard, DesignerDestination, DestinationKind, SlotKind } from './catalog';
import { scenePlaybook, sceneSearchLinks, type TasteInput } from './scene';

export type PlaceSpec = { name: string; region?: string; kind: DestinationKind };

const maps = (query: string) => ({ href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, label: 'Search Maps' });
const yt = (query: string) => ({ href: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, label: 'Watch on YouTube' });
const ig = (tag: string) => ({ href: `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`, label: `#${tag} on Instagram` });

export function hashtagFor(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '') || 'travel';
}

export function customDestination(place: PlaceSpec): DesignerDestination {
  const where = place.region ? `${place.name}, ${place.region}` : place.name;
  const palettes: Record<DestinationKind, [string, string]> = { city: ['#f26b2a', '#8e4db8'], beach: ['#0e7490', '#f7c548'], ski: ['#1e3a8a', '#e0f2fe'] };
  return {
    id: 'custom',
    name: place.name,
    region: place.region ?? '',
    kind: place.kind,
    hashtag: hashtagFor(place.name),
    palette: palettes[place.kind],
    gateway: { iata: '', airport: `${place.name}’s airport`, onward: `a transfer to your stay (${maps(`${where} airport to city center`).href})` },
    tagline: place.kind === 'beach' ? 'Salt, sun, and nowhere to be.' : place.kind === 'ski' ? 'First chairs, long lunches, loud après.' : 'Streets to wander, tables to find, nights to remember.',
  };
}

type Seed = { slot: SlotKind[]; title: string; blurb: string; emoji: string; tags: string[]; link: DesignerCard['link']; media?: DesignerCard['media']; palette: [string, string] };

/** Idea cards for a typed-in place, shaped by the group's taste. */
export function placeCards(place: PlaceSpec, options: { tags: string[]; foods?: string[]; taste?: TasteInput } = { tags: [] }): DesignerCard[] {
  const where = place.region ? `${place.name} ${place.region}` : place.name;
  const tag = hashtagFor(place.name);
  const kids = options.tags.includes('kids');
  const seeds: Seed[] = [
    { slot: ['arrive'], title: `Land and settle into ${place.name}`, blurb: 'Drop bags, walk the block, find the corner café you’ll come back to.', emoji: '🧳', tags: ['kids'], link: maps(`${where} airport to city center`), palette: ['#334155', '#e2e8f0'] },
    { slot: ['arrive', 'afternoon'], title: `${place.name}, the vibe check`, blurb: 'Watch a few minutes of the place before you’re in it.', emoji: '🎬', tags: ['views'], link: yt(`${where} travel guide`), media: 'video', palette: ['#7c2d12', '#fed7aa'] },
    ...(place.kind === 'ski'
      ? [
          { slot: ['morning'] as SlotKind[], title: `First chairs in ${place.name}`, blurb: 'Lift tickets, the best runs, where to rent.', emoji: '⛷️', tags: ['ski', 'active', 'big-kids'], link: maps(`ski resort ${where}`), palette: ['#1e3a8a', '#bfdbfe'] as [string, string] },
          { slot: ['morning'] as SlotKind[], title: 'Ski school for the kids', blurb: 'Group lessons so the grown-ups get a few runs.', emoji: '🎿', tags: ['kids', 'little-kids', 'ski'], link: maps(`ski school ${where}`), palette: ['#dc2626', '#fef2f2'] as [string, string] },
          { slot: ['apres'] as SlotKind[], title: `Après in ${place.name}`, blurb: 'The terrace where the day turns into a party.', emoji: '🥂', tags: ['nightlife', 'music'], link: maps(`apres ski bar ${where}`), palette: ['#b45309', '#fde68a'] as [string, string] },
        ]
      : place.kind === 'beach'
        ? [
            { slot: ['morning'] as SlotKind[], title: `Beach morning in ${place.name}`, blurb: 'The best stretch of sand before the crowds.', emoji: '🏖️', tags: ['water', 'kids', 'views'], link: maps(`best beaches ${where}`), palette: ['#0891b2', '#cffafe'] as [string, string] },
            { slot: ['morning', 'afternoon'] as SlotKind[], title: 'Snorkel or boat trip', blurb: 'Get on the water: reefs, coves, a skipper who knows the spots.', emoji: '🤿', tags: ['water', 'active', 'big-kids'], link: maps(`snorkeling boat tour ${where}`), palette: ['#0e7490', '#a5f3fc'] as [string, string] },
            { slot: ['apres'] as SlotKind[], title: 'Sunset drinks by the water', blurb: 'Where everyone ends up at golden hour.', emoji: '🌅', tags: ['views', 'nightlife'], link: maps(`sunset bar ${where}`), palette: ['#ea580c', '#fed7aa'] as [string, string] },
          ]
        : [
            { slot: ['morning'] as SlotKind[], title: `Walk ${place.name}’s best neighborhoods`, blurb: 'Coffee in hand, no plan, the good streets.', emoji: '☕', tags: ['culture', 'views'], link: maps(`best neighborhoods to walk ${where}`), palette: ['#78350f', '#fef3c7'] as [string, string] },
            { slot: ['morning', 'afternoon'] as SlotKind[], title: `The sights worth it in ${place.name}`, blurb: 'The famous ones that actually earn it.', emoji: '🏛️', tags: ['culture', 'kids'], link: maps(`top attractions ${where}`), palette: ['#1e3a8a', '#c7d2fe'] as [string, string] },
            { slot: ['apres'] as SlotKind[], title: 'Rooftop at golden hour', blurb: 'The skyline, the light, the first drink of the night.', emoji: '🌇', tags: ['views', 'nightlife'], link: maps(`rooftop bar ${where}`), palette: ['#c2410c', '#fed7aa'] as [string, string] },
          ]),
    { slot: ['lunch'], title: 'Lunch where locals go', blurb: 'Skip the tourist menus.', emoji: '🥘', tags: ['food'], link: maps(`best local lunch ${where}`), palette: ['#b45309', '#fde68a'] },
    { slot: ['lunch', 'morning'], title: `${place.name}’s food market`, blurb: 'Graze, people-watch, eat standing up.', emoji: '🧺', tags: ['food', 'kids'], link: maps(`food market ${where}`), palette: ['#65a30d', '#ecfccb'] },
    { slot: ['afternoon'], title: `What to do in ${place.name}`, blurb: 'Ideas from people who just went.', emoji: '📍', tags: ['culture'], link: ig(tag), media: 'reel', palette: ['#be185d', '#fce7f3'] },
    ...(kids ? [{ slot: ['afternoon', 'morning'] as SlotKind[], title: `${place.name} with kids`, blurb: 'Parks, pools, and things they’ll talk about.', emoji: '🧒', tags: ['kids', 'little-kids'], link: maps(`things to do with kids ${where}`), palette: ['#f97316', '#ffedd5'] as [string, string] }] : []),
    ...(options.tags.includes('wellness') ? [{ slot: ['afternoon', 'apres'] as SlotKind[], title: 'Spa hour', blurb: 'Sauna, steam, a massage.', emoji: '🧖', tags: ['wellness'], link: maps(`spa ${where}`), palette: ['#0f766e', '#ccfbf1'] as [string, string] }] : []),
    { slot: ['dinner'], title: `The dinner in ${place.name}`, blurb: 'The table worth booking ahead.', emoji: '🕯️', tags: ['food'], link: maps(`best restaurants ${where}`), palette: ['#7f1d1d', '#fecaca'] },
    ...(kids ? [{ slot: ['dinner'] as SlotKind[], title: 'Family dinner, zero stress', blurb: 'Good food, loud room, nobody minds the kids.', emoji: '🍕', tags: ['kids', 'hearty'], link: maps(`family friendly restaurant ${where}`), palette: ['#b91c1c', '#fee2e2'] as [string, string] }] : []),
    { slot: ['late'], title: `Cocktails in ${place.name}`, blurb: 'The bar with a story.', emoji: '🍸', tags: ['nightlife'], link: maps(`best cocktail bar ${where}`), palette: ['#4c1d95', '#ddd6fe'] },
  ];

  for (const food of (options.foods ?? []).slice(0, 3)) {
    seeds.push({ slot: ['lunch', 'dinner'], title: `${food} in ${place.name}`, blurb: 'Because it’s your thing.', emoji: '🍽️', tags: ['food'], link: maps(`best ${food} ${where}`), palette: ['#ea580c', '#fef3c7'] });
  }
  if (options.taste) {
    for (const scene of scenePlaybook(options.taste, 3)) {
      const link = sceneSearchLinks(scene, where)[0];
      seeds.push({ slot: ['late'], title: `${scene.label} in ${place.name}`, blurb: scene.why, emoji: scene.emoji, tags: ['nightlife', 'music'], link: { href: link.href, label: 'Search Maps' }, palette: ['#6b21a8', '#f5d0fe'] });
    }
  } else {
    seeds.push({ slot: ['late'], title: `Live music tonight in ${place.name}`, blurb: 'Whoever’s playing, wherever it’s loud.', emoji: '🎤', tags: ['music', 'nightlife'], link: maps(`live music bar ${where}`), palette: ['#831843', '#fbcfe8'] });
  }

  return seeds.map((seed, index) => ({
    id: `custom:${index}`,
    destination: 'custom' as const,
    slots: seed.slot,
    title: seed.title,
    blurb: seed.blurb,
    media: seed.media ?? 'poster',
    palette: seed.palette,
    emoji: seed.emoji,
    tags: seed.tags,
    link: seed.link,
  }));
}

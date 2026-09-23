import { EVENTS } from '@/lib/data/events';
import { indexDestinations } from '@/lib/pulse';
import type { EventCategory, WorldEvent } from '@/lib/types';

export type ActivityFilter = 'all' | 'music' | 'culinary' | 'ski' | 'art' | 'nature' | 'sailing';

export const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All scenes' },
  { id: 'music', label: 'Music' },
  { id: 'culinary', label: 'Food' },
  { id: 'ski', label: 'Ski' },
  { id: 'art', label: 'Art & culture' },
  { id: 'nature', label: 'Nature' },
  { id: 'sailing', label: 'On the water' },
];

type SceneSeed = {
  eventId: string;
  line: string;
  kicker: string;
  tags: string[];
  art: 'amber' | 'blue' | 'rose' | 'green' | 'violet' | 'gold';
};

const SEEDS: SceneSeed[] = [
  { eventId: 'montreux-jazz-festival', line: 'An evening that belongs to the lake.', kicker: 'THE SOUNDTRACK', tags: ['#Montreux', '#JazzAfterDark'], art: 'violet' },
  { eventId: 'aspen-christmas-week', line: 'First chair. Last light. Stay a little longer.', kicker: 'THE MOUNTAIN', tags: ['#Aspen', '#WinterPlans'], art: 'blue' },
  { eventId: 'oktoberfest-munich', line: 'There is no quiet way to do Munich in September.', kicker: 'THE TABLE', tags: ['#Munich', '#AroundTheTable'], art: 'amber' },
  { eventId: 'kyoto-cherry-blossom', line: 'For a few weeks, the whole city changes tempo.', kicker: 'THE SEASON', tags: ['#Kyoto', '#SpringInJapan'], art: 'rose' },
  { eventId: 'venice-biennale-arte', line: 'Take the long way between the pavilions.', kicker: 'THE CULTURE', tags: ['#Venice', '#ArtTravel'], art: 'gold' },
  { eventId: 'aurora-tromso', line: 'Go north. Leave room for surprise.', kicker: 'THE WILDERNESS', tags: ['#Tromso', '#NorthernSkies'], art: 'green' },
  { eventId: 'coachella-weekend-one', line: 'The desert has its own after-hours.', kicker: 'THE SOUNDTRACK', tags: ['#Coachella', '#DesertNights'], art: 'amber' },
  { eventId: 'ultra-music-festival-miami', line: 'The whole city moves to one beat.', kicker: 'THE CROWD', tags: ['#Miami', '#FestivalNights'], art: 'rose' },
  { eventId: 'niseko-january-powder', line: 'Follow the snow, then find the onsen.', kicker: 'THE MOUNTAIN', tags: ['#Niseko', '#PowderDays'], art: 'blue' },
  { eventId: 'monaco-yacht-show', line: 'Follow the harbor lights.', kicker: 'ON THE WATER', tags: ['#Monaco', '#YachtShow'], art: 'gold' },
];

export type ActivityScene = SceneSeed & {
  event: WorldEvent;
  href: string;
  category: EventCategory;
};

const destinationIndex = indexDestinations(EVENTS);
const eventById = new Map(EVENTS.map((event) => [event.id, event]));

export const ACTIVITY_SCENES: ActivityScene[] = SEEDS.flatMap((seed) => {
  const event = eventById.get(seed.eventId);
  if (!event) return [];
  const destination = destinationIndex.byEventId.get(event.id);
  return [{ ...seed, event, href: destination ? `/destinations/${destination.slug}` : `/?event=${encodeURIComponent(event.id)}`, category: event.category }];
});

export function filterScenes(scenes: ActivityScene[], filter: ActivityFilter): ActivityScene[] {
  if (filter === 'all') return scenes;
  if (filter === 'art') return scenes.filter((scene) => ['art', 'cultural', 'design', 'film'].includes(scene.category));
  return scenes.filter((scene) => scene.category === filter);
}

export function nextSceneIndex(current: number, count: number): number {
  return count > 0 ? (current + 1) % count : 0;
}

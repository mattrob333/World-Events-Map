import type { ExaResearchQuery } from './exa';
import type { TregSearchTask } from './treg';

/** Small fixed editorial rotation. It can expand only after provider costs and
 * publication quality are observed; no public route can select paid queries. */
export const RESEARCH_TARGETS = [
  { slug: 'monte-carlo', place: 'Monte Carlo Monaco', occasion: 'Monaco Yacht Show', hashtag: 'monacoyachtshow' },
  { slug: 'aspen', place: 'Aspen Colorado', occasion: 'ski season', hashtag: 'aspenskiing' },
  { slug: 'munich', place: 'Munich Germany', occasion: 'Oktoberfest', hashtag: 'oktoberfest' },
  { slug: 'paris', place: 'Paris France', occasion: 'Fashion Week', hashtag: 'parisfashionweek' },
  { slug: 'jaipur', place: 'Jaipur India', occasion: 'Diwali', hashtag: 'diwaliinjaipur' },
  { slug: 'puerto-ayora', place: 'Puerto Ayora Galapagos', occasion: 'island travel', hashtag: 'galapagosislands' },
] as const;

export interface ResearchPlan {
  runId: string;
  startPublishedDate: string;
  exaQueries: ExaResearchQuery[];
  tregTasks: TregSearchTask[];
}

export function buildResearchPlan(now: Date): ResearchPlan {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid research date');
  const slot = Math.floor(now.getTime() / (12 * 60 * 60_000));
  const first = RESEARCH_TARGETS[(slot * 2) % RESEARCH_TARGETS.length];
  const second = RESEARCH_TARGETS[(slot * 2 + 1) % RESEARCH_TARGETS.length];
  const year = now.getUTCFullYear();
  return {
    runId: `meridian-${slot}`,
    startPublishedDate: new Date(now.getTime() - 30 * 86_400_000).toISOString(),
    exaQueries: [
      { topic: 'festivals', query: `${first.occasion} ${first.place} ${year} official dates lineup travel announcement`, destinationSlug: first.slug },
      { topic: 'social-hype', query: `${second.place} ${second.occasion} ${year} visitors travel experience recent report`, destinationSlug: second.slug },
      { topic: 'deals', query: `${first.place} travel hotel airfare deals dates ${year} official offer`, destinationSlug: first.slug },
      { topic: 'empty-legs', query: `${second.place} private aviation empty leg flight ${year} published offer`, destinationSlug: second.slug },
    ],
    tregTasks: [
      { kind: 'instagram_hashtag', term: first.hashtag, destinationSlug: first.slug },
      { kind: 'tiktok_search', term: `${second.place} ${second.occasion}`, destinationSlug: second.slug },
    ],
  };
}

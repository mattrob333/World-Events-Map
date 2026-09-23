import 'server-only';

import { createHash } from 'node:crypto';
import { signalDatabase } from '@/lib/data/durable';
import { collectExaResearch, type ExaResearchCandidate } from './exa';
import { evaluateResearchCandidates, type EditorialVerdict, type ResearchCandidate } from './jev';
import { buildResearchPlan } from './plan';
import { collectTregResearch, type TregResearchCandidate } from './treg';

export type SourceCandidate = ExaResearchCandidate | TregResearchCandidate;

export interface ResearchRow {
  id: string;
  destination_slug: string | null;
  topic: string;
  category: 'article' | 'social' | 'deal' | 'flight';
  source: 'exa' | 'treg';
  platform: string;
  title: string;
  excerpt: string;
  url: string;
  author: string | null;
  published_at: string | null;
  fetched_at: string;
  reviewed_at: string;
  decision: 'publish' | 'review' | 'reject';
  score: number | null;
  confidence: number | null;
  reasons: string[];
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString();
}

function candidateContent(candidate: SourceCandidate) {
  if (candidate.source === 'treg') return {
    url: canonicalUrl(candidate.url),
    title: candidate.title,
    excerpt: candidate.summary,
    category: 'social' as const,
    platform: candidate.platform,
    author: candidate.author,
    topic: candidate.topic,
  };
  const category: 'deal' | 'flight' | 'article' = candidate.topic === 'deals' ? 'deal'
    : candidate.topic === 'empty-legs' ? 'flight' : 'article';
  const url = canonicalUrl(candidate.canonicalUrl);
  return {
    url, title: candidate.title,
    // Exa summaries are generated. A publishable excerpt must come from the
    // source page's extracted highlights instead of unlabeled model prose.
    excerpt: candidate.highlight ?? candidate.summary ?? '',
    category, platform: new URL(url).hostname.replace(/^www\./, ''),
    author: null, topic: candidate.topic,
  };
}

function candidateId(candidate: SourceCandidate): string {
  const content = candidateContent(candidate);
  return createHash('sha256')
    .update(`${candidate.destinationSlug ?? 'world'}|${content.url}`)
    .digest('hex');
}

/** Reserve screening capacity across destinations and source types. Commercial
 * offers stay in review until a separate supplier check, so spending Jev calls
 * on them would also crowd out timely editorial and social results. */
export function selectResearchForScreening(candidates: SourceCandidate[], limit = 12): SourceCandidate[] {
  const buckets = new Map<string, SourceCandidate[]>();
  for (const candidate of candidates) {
    const category = candidateContent(candidate).category;
    if (category === 'deal' || category === 'flight') continue;
    if (candidate.source === 'exa' && !candidate.highlight) continue;
    const key = `${candidate.source}:${candidate.destinationSlug ?? 'world'}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(candidate);
    buckets.set(key, bucket);
  }
  const selected: SourceCandidate[] = [];
  while (selected.length < limit) {
    let added = false;
    for (const bucket of buckets.values()) {
      const candidate = bucket.shift();
      if (!candidate) continue;
      selected.push(candidate);
      added = true;
      if (selected.length >= limit) break;
    }
    if (!added) break;
  }
  return selected;
}

/** A deterministic publication boundary after Jev. Rates and empty legs always
 * await a separate supplier/owner confirmation, regardless of model output. */
export function prepareResearchRows(
  candidates: SourceCandidate[], verdicts: EditorialVerdict[], reviewedAt: string,
): ResearchRow[] {
  const decisions = new Map(verdicts.map((verdict) => [verdict.candidateId, verdict]));
  const seen = new Set<string>();
  const rows: ResearchRow[] = [];
  for (const candidate of candidates) {
    const id = candidateId(candidate);
    if (seen.has(id)) continue;
    seen.add(id);
    const content = candidateContent(candidate);
    const verdict = decisions.get(id);
    const commercial = content.category === 'deal' || content.category === 'flight';
    const missingSourceExcerpt = candidate.source === 'exa' && !candidate.highlight;
    const decision = !verdict ? 'review'
      : (commercial || missingSourceExcerpt) && verdict.decision === 'publish' ? 'review'
        : verdict.decision;
    const reasons = verdict?.reasonCodes ?? ['editorial_review'];
    rows.push({
      id,
      destination_slug: candidate.destinationSlug ?? null,
      topic: content.topic,
      category: content.category,
      source: candidate.source,
      platform: content.platform,
      title: content.title.slice(0, 240),
      excerpt: content.excerpt.slice(0, 450),
      url: content.url,
      author: content.author,
      published_at: candidate.publishedAt,
      fetched_at: candidate.fetchedAt,
      reviewed_at: reviewedAt,
      decision: decision === 'publish' && !candidate.publishedAt ? 'review' : decision,
      score: verdict?.score ?? null,
      confidence: verdict?.confidence ?? null,
      reasons: [
        ...reasons,
        ...(commercial && verdict?.decision === 'publish' ? ['inventory_requires_verification'] : []),
        ...(missingSourceExcerpt ? ['source_excerpt_unavailable'] : []),
      ],
    });
  }
  return rows;
}

export interface ResearchRunSummary {
  found: number;
  published: number;
  review: number;
  rejected: number;
  sources: { exa: 'updated' | 'error'; treg: 'updated' | 'error' };
}

/** Called only by the authorized, globally leased scheduler route. */
export async function runResearchSweep(now = new Date()): Promise<ResearchRunSummary> {
  const db = signalDatabase();
  if (!db) throw new Error('Durable research storage is required');
  const plan = buildResearchPlan(now);
  const exaCalls = plan.exaQueries.map((query) =>
    collectExaResearch({ queries: [query], startPublishedDate: plan.startPublishedDate, maxResultsPerQuery: 5 }));
  const tregCalls = plan.tregTasks.map((task) =>
    // Receipts give operators a charge trace without ever logging a credential
    // or a third-party response body, including for calls that later fail.
    collectTregResearch([task], {
      runId: plan.runId,
      onReceipt: (receipt) => console.info('meridian.research.treg', receipt),
    }));
  const results = await Promise.allSettled([...exaCalls, ...tregCalls]);
  const candidates: SourceCandidate[] = [];
  let exaOk = 0;
  let tregOk = 0;
  for (const [index, result] of results.entries()) {
    if (result.status !== 'fulfilled') continue;
    if (index < exaCalls.length) {
      exaOk += 1;
      candidates.push(...(result.value as ExaResearchCandidate[]));
    } else {
      tregOk += 1;
      const social = result.value as Awaited<ReturnType<typeof collectTregResearch>>;
      candidates.push(...social.candidates);
    }
  }
  if (!exaOk && !tregOk) throw new Error('All research sources failed');

  // Exact URL + destination deduplication runs before paid Jev evaluation.
  const unique = [...new Map(candidates.map((candidate) => [candidateId(candidate), candidate])).values()];
  const semanticInputs: ResearchCandidate[] = selectResearchForScreening(unique).map((candidate) => {
    const content = candidateContent(candidate);
    return {
      id: candidateId(candidate), title: content.title, url: content.url,
      summary: content.excerpt, publishedAt: candidate.publishedAt,
      source: `${candidate.source}:${content.platform}`, topic: content.topic,
      fetchedAt: candidate.fetchedAt, destinationSlug: candidate.destinationSlug ?? null,
    };
  });
  const verdicts = await evaluateResearchCandidates(semanticInputs, { maxCandidates: 12, now });
  const rows = prepareResearchRows(unique, verdicts, now.toISOString());
  if (rows.length) {
    const { error } = await db.from('meridian_research_items').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error('Could not persist research review results');
  }
  const counts = {
    published: rows.filter((row) => row.decision === 'publish').length,
    review: rows.filter((row) => row.decision === 'review').length,
    rejected: rows.filter((row) => row.decision === 'reject').length,
  };
  const sources = { exa: exaOk ? 'updated' : 'error', treg: tregOk ? 'updated' : 'error' } as const;
  const { error: controlError } = await db.from('meridian_research_control')
    .update({
      last_completed_at: now.toISOString(),
      last_status: exaOk === exaCalls.length && tregOk === tregCalls.length ? 'complete' : 'partial',
      last_published: counts.published,
      last_review: counts.review,
      last_rejected: counts.rejected,
    })
    .eq('name', 'global');
  if (controlError) throw new Error('Could not record research run status');
  return { found: rows.length, ...counts, sources };
}

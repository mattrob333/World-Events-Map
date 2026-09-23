import 'server-only';

/** A compact search result. This module never fetches or rewrites the linked article. */
export interface ResearchCandidate {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
  source: string;
  topic: string;
  fetchedAt: string;
  /** Explicit target from the retrieval plan. Null means a world-wide item. */
  destinationSlug: string | null;
}

export type EditorialDecision = 'publish' | 'review' | 'reject';

export type EditorialReasonCode =
  | 'invalid_candidate'
  | 'invalid_url'
  | 'unknown_published_at'
  | 'invalid_published_at'
  | 'stale_published_at'
  | 'invalid_fetched_at'
  | 'stale_fetch'
  | 'off_topic'
  | 'missing_source'
  | 'unknown_destination'
  | 'missing_destination_evidence'
  | 'batch_limit'
  | 'provider_unconfigured'
  | 'provider_auth_error'
  | 'provider_http_error'
  | 'provider_timeout'
  | 'provider_invalid_response'
  | 'commercial_claim'
  | 'low_relevance'
  | 'low_quality'
  | 'low_freshness'
  | 'low_model_confidence'
  | 'editorial_review';

export interface EditorialVerdict {
  candidateId: string;
  /** Eligibility for an editorial publishing step, not proof that a source is true. */
  decision: EditorialDecision;
  /** Weighted editorial score on 0–100; null when Jev did not return valid answers. */
  score: number | null;
  /** TypeSafe Score confidence; Noul answers do not have a confidence field. */
  confidence: number | null;
  /** Noul probabilities and a normalized 0–1 Score result. */
  dimensions: {
    relevance: number | null;
    quality: number | null;
    freshness: number | null;
  };
  reasonCodes: EditorialReasonCode[];
}

export interface JevEditorialOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
  /** Requests per invocation, capped at 12. Remaining candidates get a review verdict. */
  maxCandidates?: number;
  /** Per-request timeout, capped at 12 seconds. */
  timeoutMs?: number;
}

type UnknownRecord = Record<string, unknown>;

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 30 * DAY_MS;
const MAX_FETCH_AGE_MS = 2 * DAY_MS;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_CANDIDATES = 12;
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_TIMEOUT_MS = 12_000;

// A cheap topical screen before paid semantic evaluation. Topic labels alone are
// insufficient: they can merely repeat the retrieval query.
const TRAVEL_OR_EVENT = /\b(?:travel|touris(?:m|t|ts)|destinations?|trips?|vacations?|holidays?|hotels?|resorts?|airlines?|flights?|airports?|railways?|trains?|cruises?|visas?|passports?|border|routes?|skis?|skiing|skiers?|snow|snowboards?|snowboarding|yachts?|sailing|sailboats?|sailors?|beach(?:es)?|nightlife|nightclubs?|festivals?|concerts?|exhibitions?|fairs?|races?|championships?|olympics?|world cup|grand prix|marathons?|tournaments?|biennales?|opening dates?|event dates?|lineups?|tickets?)\b/i;
const COMMERCIAL_CLAIM = /\b(?:deals?|discounts?|sale|fares?|prices?|availability|inventory|empty[ -]legs?|last[ -]minute|book(?:ing)? now|tickets? (?:on sale|available))\b/i;

/** Retrieval query labels and hashtags are not evidence. These patterns are
 * checked only against the returned title and summary, before a paid call.
 * Broad regional names (for example, Galápagos for Puerto Ayora) intentionally
 * do not qualify a source for a specific destination page. */
const DESTINATION_EVIDENCE: Record<string, { label: string; aliases: RegExp[]; contradiction?: RegExp }> = {
  'monte-carlo': {
    label: 'Monte Carlo, Monaco',
    aliases: [/\bMonte[ -]?Carlo\b/i, /\bMonaco\b/i, /(?:^|\W)#?monacoyachtshow\b/i],
  },
  aspen: {
    label: 'Aspen, Colorado',
    aliases: [/\bAspen\b/i, /(?:^|\W)#?aspenskiing\b/i],
  },
  munich: {
    label: 'Munich, Germany',
    aliases: [/\bMunich\b/i, /\bMuenchen\b/i, /\bMünchen\b/i],
  },
  paris: {
    label: 'Paris, France',
    aliases: [/\bParis\b/i, /(?:^|\W)#?parisfashionweek\b/i],
    contradiction: /\bParis,?\s+(?:Texas|TX|Tennessee|TN|Kentucky|KY|Ontario|Canada)\b/i,
  },
  jaipur: {
    label: 'Jaipur, India',
    aliases: [/\bJaipur\b/i, /(?:^|\W)#?diwaliinjaipur\b/i],
  },
  'puerto-ayora': {
    label: 'Puerto Ayora, Galápagos',
    aliases: [/\bPuerto[ -]?Ayora\b/i, /(?:^|\W)#?puertoayora\b/i],
  },
};

function destinationEvidence(candidate: ResearchCandidate): EditorialReasonCode | null {
  if (candidate.destinationSlug === null) return null;
  const destination = DESTINATION_EVIDENCE[candidate.destinationSlug];
  if (!destination) return 'unknown_destination';
  const sourceText = `${candidate.title} ${candidate.summary}`;
  if (destination.contradiction?.test(sourceText)) return 'missing_destination_evidence';
  return destination.aliases.some((alias) => alias.test(sourceText))
    ? null : 'missing_destination_evidence';
}

const FRESHNESS_LEVELS = [
  'Evergreen advice, generic promotion, or a recap with no new development.',
  'A dated recap or minor update with little newly announced information.',
  'A recent, specific development or announced change with useful details.',
  'A timely original announcement or report with concrete dates, places, and named actors.',
] as const;

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function unit(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.floor(value)))
    : fallback;
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseTrustedDate(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!validCalendarDate(year, month, day)) return null;
  if (hourText !== undefined) {
    if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) return null;
    if (zone !== 'Z' && zone !== undefined) {
      const zoneHour = Number(zone.slice(1, 3));
      const zoneMinute = Number(zone.slice(4, 6));
      if (zoneHour > 23 || zoneMinute > 59) return null;
    }
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function baseVerdict(candidateId: string, decision: EditorialDecision, reasonCodes: EditorialReasonCode[]): EditorialVerdict {
  return {
    candidateId,
    decision,
    score: null,
    confidence: null,
    dimensions: { relevance: null, quality: null, freshness: null },
    reasonCodes,
  };
}

function hardFilter(candidate: ResearchCandidate, nowMs: number): EditorialVerdict | null {
  if (typeof candidate.id !== 'string' || !candidate.id.trim() ||
      typeof candidate.title !== 'string' || !candidate.title.trim() ||
      typeof candidate.summary !== 'string' || !candidate.summary.trim() ||
      typeof candidate.url !== 'string' || typeof candidate.source !== 'string' ||
      typeof candidate.topic !== 'string' || typeof candidate.fetchedAt !== 'string' ||
      (candidate.destinationSlug !== null && typeof candidate.destinationSlug !== 'string') ||
      (candidate.publishedAt !== null && typeof candidate.publishedAt !== 'string')) {
    return baseVerdict(typeof candidate.id === 'string' ? candidate.id : '', 'review', ['invalid_candidate']);
  }
  try {
    const url = new URL(candidate.url);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      return baseVerdict(candidate.id, 'reject', ['invalid_url']);
    }
  } catch {
    return baseVerdict(candidate.id, 'reject', ['invalid_url']);
  }

  if (!candidate.publishedAt) return baseVerdict(candidate.id, 'review', ['unknown_published_at']);
  const publishedMs = parseTrustedDate(candidate.publishedAt);
  if (publishedMs === null || publishedMs > nowMs + FUTURE_SKEW_MS) {
    return baseVerdict(candidate.id, 'review', ['invalid_published_at']);
  }
  if (nowMs - publishedMs > MAX_AGE_MS) {
    return baseVerdict(candidate.id, 'reject', ['stale_published_at']);
  }

  const fetchedMs = parseTrustedDate(candidate.fetchedAt);
  if (fetchedMs === null || fetchedMs > nowMs + FUTURE_SKEW_MS || publishedMs > fetchedMs + DAY_MS) {
    return baseVerdict(candidate.id, 'review', ['invalid_fetched_at']);
  }
  if (nowMs - fetchedMs > MAX_FETCH_AGE_MS) {
    return baseVerdict(candidate.id, 'review', ['stale_fetch']);
  }
  if (!TRAVEL_OR_EVENT.test(`${candidate.title} ${candidate.summary}`)) {
    return baseVerdict(candidate.id, 'reject', ['off_topic']);
  }
  if (!candidate.source.trim()) return baseVerdict(candidate.id, 'review', ['missing_source']);
  const placeReason = destinationEvidence(candidate);
  if (placeReason) return baseVerdict(candidate.id, 'review', [placeReason]);
  return null;
}

function parseAnswer(payload: unknown): { relevance: number; quality: number; freshness: number; confidence: number } | null {
  const root = record(payload);
  if (typeof root?.model !== 'string' || !root.model.startsWith('jev-')) return null;
  const answers = record(root.answers);
  const relevance = record(answers?.travel_relevance);
  const quality = record(answers?.original_evidence);
  const freshness = record(answers?.material_freshness);
  if (relevance?.type !== 'noul' || quality?.type !== 'noul' || freshness?.type !== 'score') return null;

  const relevanceValue = unit(relevance.noul);
  const qualityValue = unit(quality.noul);
  const scoreValue = freshness.score;
  const confidence = unit(freshness.confidence);
  const probabilities = record(freshness.probabilities);
  const legend = record(freshness.legend);
  if (relevanceValue === null || qualityValue === null || confidence === null ||
      typeof scoreValue !== 'number' || !Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 3 ||
      !probabilities || !legend) return null;

  const levels = [0, 1, 2, 3].map((level) => unit(probabilities[String(level)]));
  if (levels.some((value) => value === null) ||
      [0, 1, 2, 3].some((level) => typeof legend[String(level)] !== 'string')) return null;
  const values = levels as number[];
  const sum = values.reduce((total, value) => total + value, 0);
  const weightedScore = values.reduce((total, value, level) => total + level * value, 0);
  if (Math.abs(sum - 1) > 0.02 || Math.abs(weightedScore - scoreValue) > 0.05) return null;

  return { relevance: relevanceValue, quality: qualityValue, freshness: scoreValue / 3, confidence };
}

function rate(candidate: ResearchCandidate, values: NonNullable<ReturnType<typeof parseAnswer>>): EditorialVerdict {
  const { relevance, quality, freshness, confidence } = values;
  const score = Math.round((relevance * 0.4 + quality * 0.4 + freshness * 0.2) * 100);
  const reasonCodes: EditorialReasonCode[] = [];
  const commercialClaim = COMMERCIAL_CLAIM.test(`${candidate.title} ${candidate.summary}`);
  if (commercialClaim) reasonCodes.push('commercial_claim');
  if (relevance < 0.35) reasonCodes.push('low_relevance');
  if (quality < 0.35) reasonCodes.push('low_quality');
  if (freshness < 0.35) reasonCodes.push('low_freshness');
  if (confidence < 0.7) reasonCodes.push('low_model_confidence');

  let decision: EditorialDecision;
  if (commercialClaim) {
    decision = 'review';
  } else if (reasonCodes.some((code) => code === 'low_relevance' || code === 'low_quality' || code === 'low_freshness')) {
    decision = 'reject';
  } else if (!commercialClaim && relevance >= 0.8 && quality >= 0.8 && freshness >= 0.7 && confidence >= 0.7) {
    decision = 'publish';
  } else {
    decision = 'review';
    if (reasonCodes.length === 0) reasonCodes.push('editorial_review');
  }

  return {
    candidateId: candidate.id,
    decision,
    score,
    confidence,
    dimensions: { relevance, quality, freshness },
    reasonCodes,
  };
}

async function evaluateOne(
  candidate: ResearchCandidate,
  fetchImpl: typeof fetch,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<EditorialVerdict> {
  const state = {
    title: candidate.title.slice(0, 300),
    summary: candidate.summary.slice(0, 1600),
    published_at: candidate.publishedAt,
    source: candidate.source.slice(0, 200),
    topic: candidate.topic.slice(0, 120),
    destination: candidate.destinationSlug === null
      ? null : DESTINATION_EVIDENCE[candidate.destinationSlug]?.label ?? null,
  };
  const questions = {
    travel_relevance: {
      type: 'noul',
      instructions: candidate.destinationSlug === null
        ? 'Does `title` and `summary` describe a concrete development relevant to travel planning, a destination experience, or a dated event a traveler could attend?'
        : 'Does `title` and `summary` describe a concrete development that a traveler to `destination` could use? The named destination must be the actual place of the experience, event, or material travel change. Incidental mentions, an author or operator based there, and nearby regional references do not qualify. Do not infer location from `topic` or `source`.',
      criteria: {
        true: 'A traveler could use the development to choose when or where to go, or understand a material travel change.',
        false: 'Only incidental place names, generic lifestyle content, or unrelated news.',
      },
    },
    original_evidence: {
      type: 'noul',
      instructions: 'Does `title` and `summary` contain specific, attributable reporting or primary-source detail rather than generic promotion, affiliate copy, or unsupported claims? The `source` field is only a label, not evidence by itself.',
      criteria: {
        true: 'Names an organizer, operator, venue, authority, or source and gives a concrete announcement, date, location, or change.',
        false: 'Vague hype, duplicated listicle or SEO copy, sales language, or no identifiable basis for the claim.',
      },
    },
    material_freshness: {
      type: 'score',
      instructions: 'How much genuinely new, time-bound information is present in `title` and `summary`? Use `published_at` as context; do not infer facts absent from the supplied text.',
      criteria: [...FRESHNESS_LEVELS],
    },
  };

  let response: Response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ state, model, questions }),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // Never include provider exception text: it may contain headers or the key.
    return baseVerdict(candidate.id, 'review', [
      error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'provider_timeout'
        : 'provider_http_error',
    ]);
  }
  if (response.status === 401) return baseVerdict(candidate.id, 'review', ['provider_auth_error']);
  if (!response.ok) return baseVerdict(candidate.id, 'review', ['provider_http_error']);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return baseVerdict(candidate.id, 'review', ['provider_invalid_response']);
  }
  const answer = parseAnswer(payload);
  return answer ? rate(candidate, answer) : baseVerdict(candidate.id, 'review', ['provider_invalid_response']);
}

/**
 * Editorial screening only. A caller must still verify the source page and own
 * all persistence and publication rules. No headline or article text is generated.
 */
export async function evaluateResearchCandidates(
  candidates: ResearchCandidate[],
  options: JevEditorialOptions = {},
): Promise<EditorialVerdict[]> {
  const nowMs = options.now?.getTime() ?? Date.now();
  if (!Number.isFinite(nowMs)) throw new Error('Invalid evaluation time.');
  const maxCandidates = boundedInteger(options.maxCandidates, MAX_CANDIDATES, 0, MAX_CANDIDATES);
  const timeoutMs = boundedInteger(options.timeoutMs, MAX_TIMEOUT_MS, 1, MAX_TIMEOUT_MS);
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY ?? '';
  const model = options.model ?? process.env.TYPESAFE_MODEL ?? 'jev-latest';
  const fetchImpl = options.fetchImpl ?? fetch;
  const verdicts: EditorialVerdict[] = new Array(candidates.length);
  const eligible: number[] = [];

  candidates.forEach((candidate, index) => {
    const hardVerdict = hardFilter(candidate, nowMs);
    if (hardVerdict) verdicts[index] = hardVerdict;
    else if (eligible.length >= maxCandidates) verdicts[index] = baseVerdict(candidate.id, 'review', ['batch_limit']);
    else eligible.push(index);
  });

  if (!apiKey) {
    eligible.forEach((index) => { verdicts[index] = baseVerdict(candidates[index]!.id, 'review', ['provider_unconfigured']); });
    return verdicts;
  }

  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, eligible.length) }, async () => {
    while (cursor < eligible.length) {
      const index = eligible[cursor++]!;
      verdicts[index] = await evaluateOne(candidates[index]!, fetchImpl, apiKey, model, timeoutMs);
    }
  }));
  return verdicts;
}

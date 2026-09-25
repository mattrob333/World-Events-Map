import 'server-only';

import { createHash } from 'node:crypto';

/**
 * The decision layer. Jev (TypeSafe's System One model) reads a compact state
 * and answers typed questions with probabilities; it never writes prose.
 *
 *   LLM   generates      (explanations, briefs)
 *   Jev   decides        (route, rubric score, yes/no probability)
 *   code  enforces       (thresholds, budgets, writes, anything with side effects)
 *
 * Every call belongs to a versioned decision contract and leaves a receipt:
 * the contract, a hash of the state, every full distribution, the route code
 * chose and whether an action was taken. Jev recommends; code authorizes.
 */

/** Whether this deployment can ask Jev at all. Without a key, routes skip Jev, its limiter and its receipts. */
export function jevConfigured(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY);
}

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export type ChoiceQuestion = { type: 'choice'; instructions: string; criteria: Record<string, string> };
export type ScoreQuestion = { type: 'score'; instructions: string; criteria: string[] };
export type NoulQuestion = { type: 'noul'; instructions: string; criteria?: { true: string; false: string } };
export type JevQuestion = ChoiceQuestion | ScoreQuestion | NoulQuestion;

/** Exactly one option wins. Include an escape hatch ("none", "other", "review") when the menu may be incomplete. */
export const choice = (instructions: string, criteria: Record<string, string>): ChoiceQuestion => ({ type: 'choice', instructions, criteria });
/** A position on an ordered rubric. 1.6 is between levels 1 and 2, not "80% good". */
export const score = (instructions: string, criteria: string[]): ScoreQuestion => ({ type: 'score', instructions, criteria });
/** Probability that a statement is true. 0.5 means "can't tell", not "medium risk". */
export const noul = (instructions: string, criteria?: { true: string; false: string }): NoulQuestion => ({ type: 'noul', instructions, criteria });

export type ChoiceAnswer = { type: 'choice'; selected: string; probabilities: Record<string, number>; confidence: number | null };
export type ScoreAnswer = { type: 'score'; score: number; levels: number; probabilities: number[]; confidence: number | null };
export type NoulAnswer = { type: 'noul'; p: number };
export type JevAnswer = ChoiceAnswer | ScoreAnswer | NoulAnswer;

export type AnswersFor<Q extends Record<string, JevQuestion>> = {
  [K in keyof Q]: Q[K] extends ChoiceQuestion ? ChoiceAnswer : Q[K] extends ScoreQuestion ? ScoreAnswer : NoulAnswer;
};

export type JevFailure = 'unconfigured' | 'auth' | 'http' | 'timeout' | 'invalid_response';

export type JevResult<Q extends Record<string, JevQuestion>> =
  | { ok: true; answers: AnswersFor<Q>; model: string; latencyMs: number }
  | { ok: false; failure: JevFailure; latencyMs: number };

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj | null => (value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : null);
const unit = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null);

/** Validates one answer against the question it answers. Anything off-shape is rejected, never guessed. */
export function parseAnswer(question: JevQuestion, raw: unknown): JevAnswer | null {
  const answer = obj(raw);
  if (!answer || answer.type !== question.type) return null;
  if (question.type === 'noul') {
    const p = unit(answer.noul);
    return p === null ? null : { type: 'noul', p };
  }
  const probabilities = obj(answer.probabilities);
  if (!probabilities) return null;
  const confidence = unit(answer.confidence);
  if (question.type === 'choice') {
    const options = Object.keys(question.criteria);
    const values = options.map((option) => unit(probabilities[option]));
    if (values.some((value) => value === null)) return null;
    const sum = (values as number[]).reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 1) > 0.02) return null;
    let best = 0;
    options.forEach((_, i) => { if ((values[i] as number) > (values[best] as number)) best = i; });
    return { type: 'choice', selected: options[best]!, probabilities: Object.fromEntries(options.map((option, i) => [option, values[i] as number])), confidence };
  }
  const levels = question.criteria.length;
  const values = Array.from({ length: levels }, (_, level) => unit(probabilities[String(level)]));
  const value = answer.score;
  if (values.some((v) => v === null) || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > levels - 1) return null;
  const sum = (values as number[]).reduce((total, v) => total + v, 0);
  if (Math.abs(sum - 1) > 0.02) return null;
  return { type: 'score', score: value, levels, probabilities: values as number[], confidence };
}

export function stateHash(state: unknown): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0, 32);
}

export type AskOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Ask independent questions against one state snapshot in one request.
 * Dependent questions need a state update between calls.
 */
export async function askJev<Q extends Record<string, JevQuestion>>(state: Obj, questions: Q, options: AskOptions = {}): Promise<JevResult<Q>> {
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY ?? '';
  const model = options.model ?? process.env.TYPESAFE_MODEL ?? 'jev-latest';
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  if (!apiKey) return { ok: false, failure: 'unconfigured', latencyMs: 0 };

  let response: Response;
  try {
    response = await fetchImpl(JEV_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ state, model, questions }),
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.min(12_000, Math.max(1, options.timeoutMs ?? 10_000))),
    });
  } catch (error) {
    // Never surface provider exception text: it may carry headers or the key.
    return { ok: false, failure: error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'http', latencyMs: elapsed() };
  }
  if (response.status === 401 || response.status === 403) return { ok: false, failure: 'auth', latencyMs: elapsed() };
  if (!response.ok) return { ok: false, failure: 'http', latencyMs: elapsed() };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, failure: 'invalid_response', latencyMs: elapsed() };
  }
  const root = obj(payload);
  const answers = obj(root?.answers);
  if (typeof root?.model !== 'string' || !root.model.startsWith('jev-') || !answers) return { ok: false, failure: 'invalid_response', latencyMs: elapsed() };
  const parsed: Record<string, JevAnswer> = {};
  for (const [id, question] of Object.entries(questions)) {
    const answer = parseAnswer(question, answers[id]);
    if (!answer) return { ok: false, failure: 'invalid_response', latencyMs: elapsed() };
    parsed[id] = answer;
  }
  return { ok: true, answers: parsed as AnswersFor<Q>, model: root.model, latencyMs: elapsed() };
}

/** What gets stored for every decision, taken or not. */
export type DecisionReceipt = {
  contract: string;
  subject: string;
  stateHash: string;
  model: string | null;
  latencyMs: number;
  answers: Record<string, JevAnswer> | null;
  failure: JevFailure | null;
  /** What code decided to do with the answers. */
  route: string;
  /** Shadow mode records the route without acting on it. */
  actionTaken: boolean;
  createdAt: string;
};

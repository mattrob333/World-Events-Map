import 'server-only';

import type { JudgmentProvider } from './providers';
import type { CandidateJudgment, JudgmentInput } from './types';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function probabilities(value: unknown): Record<string, number> {
  const source = record(value);
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, raw]) => [key, number(raw)] as const)
      .filter((entry): entry is [string, number] => entry[1] !== undefined),
  );
}

function compactFacts(facts: Record<string, unknown>): string {
  const entries = Object.entries(facts).filter(([, value]) => value !== undefined && value !== null);
  return JSON.stringify(Object.fromEntries(entries)).slice(0, 1200);
}

export class TypeSafeJudgmentProvider implements JudgmentProvider {
  readonly id = 'typesafe-jev';

  constructor(
    private readonly apiKey = process.env.TYPESAFE_API_KEY ?? '',
    private readonly model = process.env.TYPESAFE_MODEL ?? 'jev-latest',
  ) {}

  async judge(input: JudgmentInput): Promise<CandidateJudgment[]> {
    if (!this.apiKey) throw new Error('TypeSafe is not configured.');
    if (input.candidates.length === 0) return [];
    if (input.candidates.length === 1) {
      return [{
        candidateId: input.candidates[0].id,
        score: 100,
        confidence: 1,
        reasons: ['Only viable candidate after hard filters'],
      }];
    }

    const candidates = input.candidates.slice(0, 12);
    const criteria = Object.fromEntries(
      candidates.map((candidate) => [candidate.id, compactFacts(candidate.facts)]),
    );
    const questions = Object.fromEntries(
      input.questions.map((question) => [
        question.id,
        {
          type: 'choice',
          instructions: question.prompt,
          criteria,
        },
      ]),
    );

    const state = JSON.stringify({
      traveler_context: input.context,
      candidate_ids: candidates.map((candidate) => candidate.id),
    });

    const response = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ state, model: this.model, questions }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) throw new Error(`TypeSafe request failed with status ${response.status}.`);
    const payload: unknown = await response.json();
    const root = record(payload);
    const answers = record(root?.answers);
    if (!answers) throw new Error('TypeSafe returned an invalid response.');

    const accum = new Map<string, { total: number; count: number; confidence: number; confidenceCount: number; reasons: string[] }>();
    for (const candidate of candidates) {
      accum.set(candidate.id, { total: 0, count: 0, confidence: 0, confidenceCount: 0, reasons: [] });
    }

    for (const question of input.questions) {
      const answer = record(answers[question.id]);
      if (!answer) continue;
      const distribution = probabilities(answer.probabilities);
      const confidence = number(answer.confidence);
      const highest = Math.max(0, ...Object.values(distribution));

      for (const candidate of candidates) {
        const value = distribution[candidate.id];
        if (value === undefined) continue;
        const item = accum.get(candidate.id)!;
        const relative = highest > 0 ? value / highest : 0.5;
        item.total += Math.max(0, Math.min(1, relative)) * 100;
        item.count += 1;
        if (confidence !== undefined) {
          item.confidence += confidence;
          item.confidenceCount += 1;
        }
        if (highest > 0 && value >= highest * 0.75) item.reasons.push(question.prompt);
      }
    }

    return candidates.map((candidate) => {
      const item = accum.get(candidate.id)!;
      return {
        candidateId: candidate.id,
        score: item.count ? item.total / item.count : 50,
        confidence: item.confidenceCount ? item.confidence / item.confidenceCount : undefined,
        reasons: item.reasons.slice(0, 3),
      };
    });
  }
}

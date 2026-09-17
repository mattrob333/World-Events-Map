import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { TypeSafeJudgmentProvider } from '../typesafe';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TypeSafeJudgmentProvider', () => {
  it('maps Choice probabilities into relative candidate scores', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'jev-latest',
          answers: {
            fit: {
              type: 'choice',
              choice: 'a',
              probabilities: { a: 0.6, b: 0.4 },
              confidence: 0.2,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new TypeSafeJudgmentProvider('secret', 'jev-latest');
    const result = await provider.judge({
      context: { vibe: 'social' },
      questions: [{ id: 'fit', prompt: 'Which place fits this traveler best?' }],
      candidates: [
        { id: 'a', facts: { name: 'A' } },
        { id: 'b', facts: { name: 'B' } },
      ],
    });

    expect(result[0]).toMatchObject({
      candidateId: 'a',
      score: 100,
      confidence: 0.2,
    });
    expect(result[1]?.score).toBeCloseTo(66.67, 1);
    expect(result[0]?.reasons).toContain('Which place fits this traveler best?');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer secret' });
    const body = JSON.parse(String(init.body));
    expect(body.questions.fit).toMatchObject({
      type: 'choice',
      instructions: 'Which place fits this traveler best?',
    });
    expect(Object.keys(body.questions.fit.criteria)).toEqual(['a', 'b']);
  });

  it('rejects a response without a complete usable probability distribution', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'jev-latest',
          answers: {
            fit: {
              type: 'choice',
              choice: 'a',
              probabilities: { a: 1 },
              confidence: 1,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new TypeSafeJudgmentProvider('secret');
    await expect(
      provider.judge({
        context: {},
        questions: [{ id: 'fit', prompt: 'Which place fits?' }],
        candidates: [
          { id: 'a', facts: { name: 'A' } },
          { id: 'b', facts: { name: 'B' } },
        ],
      }),
    ).rejects.toThrow(/no usable candidate probability distributions/);
  });

  it('rejects probabilities that do not form a valid distribution', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: {
            fit: {
              type: 'choice',
              choice: 'a',
              probabilities: { a: 0.2, b: 0.2 },
              confidence: 0.1,
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new TypeSafeJudgmentProvider('secret');
    await expect(
      provider.judge({
        context: {},
        questions: [{ id: 'fit', prompt: 'Which place fits?' }],
        candidates: [
          { id: 'a', facts: { name: 'A' } },
          { id: 'b', facts: { name: 'B' } },
        ],
      }),
    ).rejects.toThrow(/no usable candidate probability distributions/);
  });

  it('does not call the provider when only one viable candidate remains', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new TypeSafeJudgmentProvider('secret');
    const result = await provider.judge({
      context: {},
      questions: [{ id: 'fit', prompt: 'Which place fits?' }],
      candidates: [{ id: 'only', facts: { name: 'Only option' } }],
    });

    expect(result).toEqual([
      {
        candidateId: 'only',
        score: 100,
        confidence: 1,
        reasons: ['Only viable candidate after hard filters'],
      },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

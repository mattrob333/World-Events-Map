import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { metricsForSource } from '../registry';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('signal inventory matches the repo', () => {
  it('registers every adapter source id', () => {
    const adapterDir = resolve(root, 'src/lib/data/adapters');
    const ids = readdirSync(adapterDir)
      .filter((name) => name.endsWith('.ts'))
      .flatMap((name) => {
        const match = read(`src/lib/data/adapters/${name}`).match(
          /export const \w+: EventSource = \{\s*id: '([^']+)'/,
        );
        return match ? [match[1]] : [];
      });
    expect(ids.sort()).toEqual([
      'amadeus',
      'curated',
      'google-trends',
      'predicthq',
      'ticketmaster',
      'x',
    ]);
    for (const id of ids) expect(metricsForSource(id).length).toBeGreaterThan(0);
    const registryDoc = read('docs/data/SIGNAL-REGISTRY.md');
    for (const id of ids) {
      for (const metric of metricsForSource(id)) expect(registryDoc).toContain(metric.metric);
    }
  });

  it('keeps the rights matrix and records metrics in the signal registry', () => {
    const matrix = read('docs/data/SOURCE-ACCESS-MATRIX.md');
    const registryDoc = read('docs/data/SIGNAL-REGISTRY.md');
    const honesty = read('docs/data/WIRE-HONESTY.md');
    expect(matrix).toContain('Product decision lock');
    expect(matrix).toContain('HOLD commercial');
    expect(matrix).not.toContain('Phase 0 inventory of integrations');
    expect(registryDoc).toContain('changed materially');
    expect(honesty).toContain('wire-honesty.json');
    expect(honesty).toContain('sourcePublishedAt');
  });
});

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

  it('names every env var from .env.example in the source access matrix', () => {
    const names = [...read('.env.example').matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]);
    const matrix = read('docs/data/SOURCE-ACCESS-MATRIX.md');
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) expect(matrix).toContain(name);
    expect(matrix).toContain('TODO');
  });
});

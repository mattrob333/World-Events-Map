import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { preProcessFile } from 'typescript';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), 'src/lib/data');
const read = (path: string) => readFileSync(path, 'utf8');

// Importing server-only modules in Vitest throws by design. Read source files
// as text here; no global mock weakens the boundary this test protects.
describe('server-only boundary', () => {
  it('keeps the read model and its transitive imports free of server modules', () => {
    const pending = [resolve(root, 'index.ts')];
    const visited = new Set<string>();
    while (pending.length) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      const source = read(file);
      expect(source, file).not.toMatch(/import\s*['"]server-only['"]/);
      // Includes re-exports and dynamic imports as well as import declarations.
      for (const { fileName: specifier } of preProcessFile(source, true).importedFiles) {
        expect(specifier, file).not.toMatch(/^(?:\.\/sources|\.\/adapters)(?:\/|$)/);
        expect(specifier, file).not.toBe('server-only');
        const target = specifier.startsWith('@/')
          ? resolve(process.cwd(), 'src', specifier.slice(2))
          : specifier.startsWith('.') ? resolve(dirname(file), specifier) : undefined;
        if (!target) continue;
        const resolved = [`${target}.ts`, `${target}.tsx`, resolve(target, 'index.ts')].find(existsSync);
        expect(resolved, `Resolve ${specifier} from ${file}`).toBeDefined();
        pending.push(resolved!);
      }
    }
  });

  const guarded = [
    'server.ts',
    'sources.ts',
    'durable.ts',
    'provider-events.ts',
    'social-feed.ts',
    ...readdirSync(resolve(root, 'adapters'))
      .filter((name) => name.endsWith('.ts') && name !== 'curated.ts')
      .map((name) => `adapters/${name}`),
  ];
  it.each(guarded)('%s begins with the server-only guard', (file) => {
    expect(read(resolve(root, file)).split(/\r?\n/)[0]).toBe("import 'server-only';");
  });
});

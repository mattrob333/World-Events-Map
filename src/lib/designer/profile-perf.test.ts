import { describe, expect, it } from 'vitest';
import { parseProfileLocally } from './profile';

// Red team review B2: whitespace-heavy input made the family regex backtrack for seconds.
describe('parseProfileLocally performance', () => {
  const inputs = [
    'a' + ' '.repeat(6000) + 'x',
    'two' + ' young'.repeat(900) + ' x',
    ('my ' + '\t'.repeat(40) + 'son ').repeat(120),
    'a\n'.repeat(3000),
    'I have ' + 'little '.repeat(800) + 'kids',
    'I love music, bands in ' + 'A'.repeat(60) + '!, Drake, Adele and Bad Bunny',
    'My playlist is ' + 'Ab'.repeat(40) + 'x, ' + 'in '.repeat(200) + 'Zz'.repeat(300) + '!, Drake',
  ];

  for (const [i, input] of inputs.entries()) {
    it(`finishes adversarial input ${i + 1} quickly`, () => {
      const started = performance.now();
      parseProfileLocally(input);
      expect(performance.now() - started).toBeLessThan(250);
    });
  }

  it('still reads kids after the fix', () => {
    const profile = parseProfileLocally("I'm Matt, 44, from Atlanta. Two young sons, 8 and 12.");
    expect(profile.family.filter((m) => m.relation === 'child').map((m) => m.age).sort()).toEqual([12, 8].sort());
  });
});

// MERIDIAN — ESLint 9 flat config.
//
// `next lint` was removed in Next 16, so linting is explicit here. Both entries
// below are the flat-config arrays shipped by eslint-config-next@16:
//   - core-web-vitals: the base Next/React/hooks/import/a11y set plus the
//     stricter Core Web Vitals rules
//   - typescript: typescript-eslint `recommended` (non type-checked) with
//     no-unused-vars / no-unused-expressions downgraded to warnings
//
// Rule policy: errors fail `npm run lint`; warnings are reported, never hidden.
// Anything deliberately left as a warning is listed in docs/phase0/LINT-BASELINE.md.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    // Build output, dependencies, static assets (incl. the geo artefacts that
    // scripts/build-geo.mjs writes into public/), and the docs tree.
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'public/**',
      'docs/**',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // eslint-plugin-react-hooks v7 ships the React Compiler's analysis rules
    // as errors. This project does not enable the compiler, and every site
    // they flag is a deliberate imperative pattern in the globe/timeline code
    // (Three.js objects mutated inside useFrame, latest-value refs read by the
    // frame loop, SSR-safe mount effects). Each is a design decision, not a
    // mechanical fix, so they are reported as warnings rather than hidden —
    // see docs/phase0/LINT-BASELINE.md for the per-site list.
    name: 'meridian/react-compiler-rules-as-warnings',
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
];

export default config;

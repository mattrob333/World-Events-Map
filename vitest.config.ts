import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors tsconfig.json `paths` (`@/*` → `./src/*`) so tests import the same
// modules the app does. Node environment by default; a test that needs the DOM
// opts in per-file with `// @vitest-environment jsdom` once jsdom is installed.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});

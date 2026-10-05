// Component and unit tests for the React side: `npm test` (Vitest + Testing Library, in jsdom).
// Test files sit next to what they test: ui/ProductCard.test.tsx.
import path from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {alias: {'@': path.resolve(import.meta.dirname, 'assets/react')}},
  test: {
    environment: 'jsdom',
    // jsdom once per worker, not once per file (it was 40 % of the run): each file still gets its own module graph and
    // globals (docs/pdr/prd-test-speed.md).
    pool: 'vmThreads',
    globals: true,
    include: ['assets/**/*.test.{ts,tsx}'],
    setupFiles: ['assets/react/shared/test/setup.ts'],
    css: false,
  },
});

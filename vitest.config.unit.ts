import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/e2e/**', '**/integration/**', '**/node_modules/**'],
    environment: 'node',
    globals: true,
  }
});
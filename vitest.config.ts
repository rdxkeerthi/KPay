import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['scripts/**', 'dist/**', 'tests/**', '**/*.d.ts'],
    },
    testTimeout: 10000,
  },
});

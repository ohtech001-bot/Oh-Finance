import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api-integration',
    root: __dirname,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // اختبارات التكامل تشترك في قاعدة بيانات واحدة — التوازي يفسدها.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    setupFiles: ['./test/setup.ts'],
  },
});

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'money',
      root: './packages/money',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'contracts',
      root: './packages/contracts',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'config',
      root: './packages/config',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  },
  './packages/ui/vitest.config.ts',
  './apps/web/vitest.config.ts',
  './apps/api/vitest.config.ts',
]);

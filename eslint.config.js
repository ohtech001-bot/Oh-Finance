import { node, reactConfig } from '@oh/eslint-config';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'ui/**',
      'apps/api/prisma/migrations/**',
      'apps/web/src/components/ui/**/*.d.ts',
    ],
  },

  // الحزم المشتركة + الخادم
  ...node.map((c) => ({
    ...c,
    files: ['packages/{money,contracts,config}/**/*.ts', 'apps/api/**/*.ts', 'tooling/**/*.mjs'],
  })),

  // الواجهة + حزمة الواجهات الرسومية
  ...reactConfig.map((c) => ({
    ...c,
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
  })),
];

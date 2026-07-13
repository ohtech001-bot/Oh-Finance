import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * قواعد صارمة تمنع أخطاء الأموال بالفاصلة العائمة.
 *
 * هذه ليست تفضيلًا أسلوبيًا — كل واحدة من هذه الدوال تحوّل قيمة مالية إلى
 * `number` (IEEE-754 double)، وهو ما يفقد الدقة بلا رجعة:
 *   0.1 + 0.2 === 0.30000000000000004
 *   (1.005).toFixed(2) === "1.00"   ← وليس "1.01"
 * كل حساب مالي يجب أن يمر عبر `@oh/money` (Decimal).
 */
const moneySafetyRules = {
  'no-restricted-globals': [
    'error',
    {
      name: 'parseFloat',
      message: 'ممنوع للأموال. استخدم toMoney() من @oh/money (Decimal).',
    },
  ],
  'no-restricted-properties': [
    'error',
    {
      object: 'Number',
      property: 'parseFloat',
      message: 'ممنوع للأموال. استخدم toMoney() من @oh/money.',
    },
    {
      object: 'Math',
      property: 'round',
      message: 'التقريب المالي يتم فقط في @oh/money (roundMoney) بسياسة موحّدة.',
    },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.property.name='toFixed']",
      message:
        '.toFixed() يقرّب على أرقام عائمة ويخطئ في حالات مثل (1.005).toFixed(2)="1.00". استخدم formatMoney() من @oh/money.',
    },
  ],
};

/** الأساس المشترك لكل الحزم. */
export const base = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/api/prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      ...moneySafetyRules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  prettier,
);

/** خادم Node/NestJS. */
export const node = tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.node },
  },
  rules: {
    // NestJS يعتمد على الديكوريتورات والحقن؛ المعاملات غير المستخدمة شائعة في الـDTOs.
    '@typescript-eslint/no-extraneous-class': 'off',
  },
});

/** واجهة React. */
export const reactConfig = tseslint.config(
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // ── RTL: منع الخصائص الفيزيائية التي تكسر التبديل بين ar/he/en ──
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toFixed']",
          message: 'استخدم formatMoney() من @oh/money.',
        },
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\b(ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)-/]",
          message:
            'خصائص اتجاهية فيزيائية ممنوعة — تكسر RTL. استخدم البدائل المنطقية: ms/me, ps/pe, start/end, text-start/text-end, border-s/border-e, rounded-s/rounded-e.',
        },
      ],
    },
  },
  {
    // ملفات الاختبار: تخفيف بعض القيود
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/e2e/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
);

export default base;

import { node, reactConfig } from '@oh/eslint-config';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/dist-types/**', // مخرجات tsc — ليست كودًا نكتبه
      '**/*.d.ts',
      '**/node_modules/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'ui/**', // الصور المرجعية
      'apps/api/prisma/migrations/**',
      '**/*.config.ts',
      '**/*.config.js',
      'vitest.workspace.ts',
    ],
  },

  // الحزم المشتركة + الخادم
  ...node.map((c) => ({
    ...c,
    files: ['packages/{money,contracts,config}/src/**/*.ts', 'apps/api/src/**/*.ts'],
  })),

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  ⛔ consistent-type-imports مُعطَّلة في الخادم — وهذا **إلزامي**.
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  NestJS يحقن الاعتماديات عبر `emitDecoratorMetadata`: TypeScript يُصدر
   *  `design:paramtypes` الذي يحمل **مرجعًا حقيقيًا وقت التشغيل** لصنف كل
   *  معامل في الباني.
   *
   *      constructor(private readonly prisma: PrismaService) {}
   *
   *  لو صار الاستيراد `import type { PrismaService }`، حُذف المرجع من الكود
   *  المُصدَّر، فيُصدر TS `Object` بدلًا منه، ويفشل الحقن وقت التشغيل:
   *
   *      Nest can't resolve dependencies of the AuthService (?).
   *
   *  الخطورة في أن العطل **صامت في كل بواباتنا**: الترجمة تنجح، الأنواع
   *  سليمة، الاختبارات الوحدوية تمر — وينهار الخادم عند أول طلب حقيقي.
   *
   *  ⚠️ لا تُعِد تفعيل هذه القاعدة هنا. `eslint --fix` سيكسر الخادم بصمت.
   *     (القاعدة تبقى مفعّلة في الواجهة، حيث لا ديكوريتورات ولا حقن.)
   */
  {
    files: ['apps/api/src/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },

  // الواجهة + حزمة الواجهات الرسومية
  ...reactConfig.map((c) => ({
    ...c,
    files: ['apps/web/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'],
  })),

  /**
   * سكربتات الأدوات (tooling/) — واجهة سطر أوامر.
   *
   * `console.log` هنا **هو** المخرَج المقصود: هذه السكربتات تطبع رسائل
   * إرشادية للمطوّر. قاعدة `no-console` وُضعت لكود الخادم والواجهة، حيث
   * السجل يجب أن يمر بـPino (منظّم ومنقّح) لا بـconsole.
   */
  ...node.map((c) => ({
    ...c,
    files: ['tooling/**/*.mjs', 'apps/api/prisma/seed.ts'],
    rules: { ...c.rules, 'no-console': 'off' },
  })),

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  استثناء @oh/money من قاعدة منع .toFixed()
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  القاعدة تمنع `.toFixed()` لأن `Number.prototype.toFixed` يقرّب على
   *  أرقام عائمة ويخطئ:  (1.005).toFixed(2) === "1.00"  ← وليس "1.01".
   *
   *  لكن `Decimal.prototype.toFixed()` من decimal.js **دقيق تمامًا** — يعمل
   *  على تمثيل عشري لا ثنائي. وهو الطريقة الصحيحة الوحيدة لتحويل Decimal
   *  إلى نص بعدد خانات محدد.
   *
   *  ESLint قاعدة نحوية: ترى `.toFixed(` ولا تعرف نوع المستقبِل. فنستثني
   *  الحزمة التي **تُنفّذ** المسار الآمن — وهي المكان الوحيد المسموح.
   *  أي `.toFixed()` خارجها يظل خطأً يمنع البناء.
   *
   *  هذا ليس تراخيًا: هو تركيز كل استخدام خطر في ملف واحد مُدقَّق ومُختبَر
   *  بـ42 اختبارًا، بدل تفريقه على عشرات الملفات.
   */
  {
    files: ['packages/money/src/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];

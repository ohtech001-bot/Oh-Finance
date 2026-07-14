import type { Config } from 'tailwindcss';
import { ohPreset } from '@oh/ui/tailwind-preset';

export default {
  presets: [ohPreset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // مكوّنات @oh/ui تُمسح أيضًا — وإلا حُذفت أصنافها من CSS النهائي.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;

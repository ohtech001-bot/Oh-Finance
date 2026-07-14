import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'ui',
    root: __dirname,
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
});

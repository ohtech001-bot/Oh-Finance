import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  server: {
    // يقبل التجاوز بـ`--port` (اختبارات E2E تستخدم 5199 لعزلها عن التطوير).
    port: 5173,
    strictPort: true,
    /**
     * وكيل الـAPI في التطوير.
     *
     * الفائدة الحقيقية ليست الراحة: بالوكيل تصبح الواجهة والخادم على **نفس
     * الأصل** (localhost:5173)، فتعمل كوكيز `SameSite=Lax` بلا تنازلات.
     * بدونه كنا سنضطر إلى `SameSite=None` في التطوير — أي إعداد أضعف من
     * الإنتاج، فنختبر شيئًا غير ما ننشره.
     */
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },

  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // فصل المكتبات الكبيرة — لا يُعاد تنزيلها مع كل نشر.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          charts: ['recharts'],
        },
      },
    },
  },
});

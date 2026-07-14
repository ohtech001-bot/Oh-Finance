import type { Config } from 'tailwindcss';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  نظام التصميم — مستخرج من /ui (المرجع البصري الإلزامي).
 *  العقد الكامل في docs/01-design-system.md.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  الألوان مُعرَّفة كمتغيّرات CSS في tokens.css، ونُشير إليها هنا بـ
 *  `hsl(var(--x))`. لماذا هذه الطبقة الإضافية؟ لأنها تسمح بتبديل السمة
 *  (فاتح/داكن) بتغيير المتغيّرات على `:root` وحدها — بلا إعادة بناء ولا
 *  أصناف مزدوجة على كل عنصر.
 */
export const ohPreset: Config = {
  content: [],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // ── الأسطح ──────────────────────────────────────────────────────
        bg: 'hsl(var(--bg))',
        card: 'hsl(var(--card))',
        'card-muted': 'hsl(var(--card-muted))',
        border: 'hsl(var(--border))',
        'border-subtle': 'hsl(var(--border-subtle))',

        // ── الشريط الجانبي (داكن — النمط المعتمد) ───────────────────────
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-bg))',
          fg: 'hsl(var(--sidebar-fg))',
          'fg-active': 'hsl(var(--sidebar-fg-active))',
          active: 'hsl(var(--sidebar-active-bg))',
          hover: 'hsl(var(--sidebar-hover))',
        },

        // ── الهوية ──────────────────────────────────────────────────────
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          hover: 'hsl(var(--brand-hover))',
          soft: 'hsl(var(--brand-soft))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          hover: 'hsl(var(--accent-hover))',
          soft: 'hsl(var(--accent-soft))',
        },

        /**
         * ── الألوان المالية ─────────────────────────────────────────────
         * ⚠️ محجوزة للدلالة المالية حصرًا. استخدامها للتزيين يُفقد المستخدم
         *    قدرته على قراءة حالته المالية بلمحة — وهي الوظيفة الأساسية
         *    لكل شاشة في هذا النظام.
         *
         *   debit  = مدين / دَين / متأخر  → أحمر
         *   credit = دائن / مدفوع / مقبوض → أخضر
         *   partial= مدفوع جزئيًا          → كهرماني
         */
        debit: { DEFAULT: 'hsl(var(--danger))', soft: 'hsl(var(--danger-soft))' },
        credit: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
        partial: { DEFAULT: 'hsl(var(--warning))', soft: 'hsl(var(--warning-soft))' },

        danger: { DEFAULT: 'hsl(var(--danger))', soft: 'hsl(var(--danger-soft))' },
        success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
        warning: { DEFAULT: 'hsl(var(--warning))', soft: 'hsl(var(--warning-soft))' },
        info: { DEFAULT: 'hsl(var(--info))', soft: 'hsl(var(--info-soft))' },
        neutral: { DEFAULT: 'hsl(var(--neutral))', soft: 'hsl(var(--neutral-soft))' },
        purple: { DEFAULT: 'hsl(var(--purple))', soft: 'hsl(var(--purple-soft))' },
        orange: { DEFAULT: 'hsl(var(--orange))', soft: 'hsl(var(--orange-soft))' },

        // ── النص ────────────────────────────────────────────────────────
        fg: 'hsl(var(--fg))',
        'fg-muted': 'hsl(var(--fg-muted))',
        'fg-subtle': 'hsl(var(--fg-subtle))',

        ring: 'hsl(var(--accent))',
      },

      borderRadius: {
        card: '12px',
        ctrl: '10px',
        pill: '6px',
        icon: '12px',
      },

      boxShadow: {
        card: '0 1px 3px rgba(16,24,40,.10), 0 1px 2px rgba(16,24,40,.06)',
        pop: '0 10px 24px rgba(16,24,40,.12)',
        'card-hover': '0 4px 12px rgba(16,24,40,.10)',
      },

      fontFamily: {
        // مُستضاف ذاتيًا — لا CDN (سياسة CSP + الخصوصية + العمل بلا إنترنت).
        sans: ['IBM Plex Sans Arabic', 'Noto Sans Hebrew', 'system-ui', 'sans-serif'],
        he: ['Noto Sans Hebrew', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'page-title': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        'card-title': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        kpi: ['26px', { lineHeight: '34px', fontWeight: '700' }],
        'table-head': ['13px', { lineHeight: '18px', fontWeight: '600' }],
        badge: ['12px', { lineHeight: '16px', fontWeight: '600' }],
      },

      spacing: {
        sidebar: '260px',
        'sidebar-collapsed': '72px',
        topbar: '72px',
        'mobile-tabbar': '72px',
      },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-start': {
          from: { transform: 'translateX(var(--slide-from, 100%))' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(var(--shimmer-to, -100%))' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in-start': 'slide-in-start 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default ohPreset;

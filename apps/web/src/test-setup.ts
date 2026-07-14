import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom لا ينفّذ matchMedia — يحتاجه ThemeProvider لقراءة تفضيل النظام.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Radix يستخدمه لقياس العناصر.
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

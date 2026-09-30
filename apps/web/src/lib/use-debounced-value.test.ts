import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './use-debounced-value';

describe('useDebouncedValue', () => {
  afterEach(() => vi.useRealTimers());
  it('only submits the latest search after typing pauses', () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: '' },
    });
    rerender({ value: 'a' });
    act(() => vi.advanceTimersByTime(100));
    rerender({ value: 'ali' });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('');
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('ali');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

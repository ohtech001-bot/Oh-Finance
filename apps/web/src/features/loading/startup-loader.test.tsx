import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartupLoader } from './startup-loader';

let loading = false;
vi.mock('@/app/auth-context', () => ({ useAuth: () => ({ isLoading: loading }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => {
  loading = false;
  vi.useRealTimers();
});

describe('startup loading', () => {
  it('does not hide an already-ready page for an artificial minimum delay', () => {
    render(
      <StartupLoader>
        <div>ready page</div>
      </StartupLoader>,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('ready page')).toBeVisible();
  });

  it('shows the animation only during session loading and its short exit transition', () => {
    vi.useFakeTimers();
    loading = true;
    const view = render(
      <StartupLoader>
        <div>ready page</div>
      </StartupLoader>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    loading = false;
    view.rerender(
      <StartupLoader>
        <div>ready page</div>
      </StartupLoader>,
    );
    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

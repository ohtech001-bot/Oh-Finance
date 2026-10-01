import { Suspense, lazy } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';

vi.mock('@/app/auth-context', () => ({
  useAuth: () => ({ user: { isSuperAdmin: false, permissions: [], store: { name: 'Store' } } }),
}));
vi.mock('@/app/route-prefetch', () => ({ prefetchPrimaryRoutes: () => () => {} }));
vi.mock('./sidebar', () => ({ Sidebar: () => <Link to="/slow">navigate</Link> }));
vi.mock('./mobile-tabbar', () => ({ MobileTabBar: () => <div>mobile navigation</div> }));
vi.mock('./topbar', () => ({ Topbar: () => <div>topbar</div> }));

describe('page loading boundary', () => {
  it('keeps the shell visible while a new page module is downloading', async () => {
    const SlowPage = lazy(() => new Promise<{ default: () => null }>(() => {}));
    render(
      <MemoryRouter>
        <Suspense fallback={<div>whole app blocked</div>}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<div>initial page</div>} />
              <Route path="slow" element={<SlowPage />} />
            </Route>
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByText('navigate')[0]!);
    expect(await screen.findByText('topbar')).toBeVisible();
    expect(screen.getByText('mobile navigation')).toBeVisible();
    expect(screen.queryByText('whole app blocked')).not.toBeInTheDocument();
    expect(document.querySelector('#main-content [aria-busy="true"]')).toBeInTheDocument();
  });
});

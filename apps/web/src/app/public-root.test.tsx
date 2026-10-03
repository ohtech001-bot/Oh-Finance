import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicRoot } from './public-root';

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, isLoading: false }));
vi.mock('./auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/features/landing/landing-page', () => ({
  LandingPage: () => <h1>public landing</h1>,
}));

function renderRoot() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PublicRoot />}>
          <Route index element={<div>existing authenticated route</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('public home routing', () => {
  beforeEach(() => {
    auth.user = null;
    auth.isLoading = false;
  });
  it('shows the landing page to a visitor', async () => {
    renderRoot();
    expect(await screen.findByText('public landing')).toBeInTheDocument();
    expect(screen.queryByText('existing authenticated route')).not.toBeInTheDocument();
  });
  it('keeps the authenticated route for an existing session', () => {
    auth.user = { id: 'test-owner' };
    renderRoot();
    expect(screen.getByText('existing authenticated route')).toBeInTheDocument();
    expect(screen.queryByText('public landing')).not.toBeInTheDocument();
  });
  it('leaves session loading to the existing auth guard', () => {
    auth.isLoading = true;
    renderRoot();
    expect(screen.getByText('existing authenticated route')).toBeInTheDocument();
    expect(screen.queryByText('public landing')).not.toBeInTheDocument();
  });
});

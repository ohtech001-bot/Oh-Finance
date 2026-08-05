import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SessionUser } from '@oh/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireTenant } from './guards';

let currentUser: SessionUser | null = null;

vi.mock('./auth-context', () => ({
  useAuth: () => ({
    user: currentUser,
    isLoading: false,
    isAuthenticated: Boolean(currentUser),
  }),
}));

const baseUser: SessionUser = {
  id: '9b29c2f7-4998-48f6-9ed1-702f6b53f84a',
  email: 'manager@example.com',
  name: 'Manager',
  avatarUrl: null,
  role: 'GENERAL_MANAGER',
  permissions: [],
  locale: 'ar',
  isSuperAdmin: true,
  supportMode: false,
  mustChangePassword: false,
  twoFactorEnabled: false,
  tenant: null,
  store: null,
};

function renderTenantGuard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<RequireTenant />}>
          <Route index element={<div>tenant dashboard</div>} />
        </Route>
        <Route path="platform" element={<div>platform dashboard</div>} />
        <Route path="403" element={<div>forbidden</div>} />
        <Route path="login" element={<div>login</div>} />
        <Route path="change-initial-password" element={<div>change password</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireTenant', () => {
  beforeEach(() => {
    currentUser = null;
  });

  it('يسمح لجلسة دعم مكتملة حتى لو بقيت صفة المدير العام في بيانات مؤقتة', () => {
    currentUser = {
      ...baseUser,
      supportMode: true,
      tenant: {
        id: '498d9cd9-bab4-4c99-8174-33447d09eec9',
        name: 'Tenant',
        slug: 'tenant',
        status: 'ACTIVE',
      },
      store: {
        id: '8307a450-0e45-48f8-a6eb-36329bbd6db9',
        code: 'STORE-1',
        name: 'Store',
        currency: 'ILS',
        logoUrl: null,
        phone: null,
        taxEnabled: false,
        taxRate: 0,
        timezone: 'Asia/Jerusalem',
      },
    };

    renderTenantGuard();
    expect(screen.getByText('tenant dashboard')).toBeInTheDocument();
  });

  it('يرفض جلسة دعم ناقصة لا تحمل محلًا وفرعًا', () => {
    currentUser = { ...baseUser, supportMode: true };
    renderTenantGuard();
    expect(screen.getByText('forbidden')).toBeInTheDocument();
  });

  it('يبقي المدير العام العادي داخل لوحة المنصة', () => {
    currentUser = baseUser;
    renderTenantGuard();
    expect(screen.getByText('platform dashboard')).toBeInTheDocument();
  });
});

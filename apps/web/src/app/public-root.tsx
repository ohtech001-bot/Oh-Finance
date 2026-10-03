import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from './auth-context';
import { FullPageLoader } from '@/components/full-page-loader';

const LandingPage = lazy(() =>
  import('@/features/landing/landing-page').then((module) => ({
    default: module.LandingPage,
  })),
);

export function PublicRoot() {
  const { user, isLoading } = useAuth();
  if (isLoading || user) return <Outlet />;
  return (
    <Suspense fallback={<FullPageLoader />}>
      <LandingPage />
    </Suspense>
  );
}

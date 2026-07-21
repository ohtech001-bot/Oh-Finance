import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, LoginResponse, SessionUser } from '@oh/contracts';
import type { Permission } from '@oh/config';
import { api, UNAUTHENTICATED_EVENT } from '@/lib/api';

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  enterTenantSupport: (tenantId: string) => Promise<LoginResponse>;
  exitTenantSupport: () => Promise<LoginResponse>;

  /** هل يملك المستخدم الصلاحية؟ **للتجربة فقط** — لا يحل محل فحص الخادم. */
  can: (permission: Permission) => boolean;
  canAny: (...permissions: Permission[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleUnauthenticated = () => {
      queryClient.setQueryData(['auth', 'me'], null);
      void queryClient.cancelQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      });
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'auth',
      });
    };

    window.addEventListener(UNAUTHENTICATED_EVENT, handleUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, handleUnauthenticated);
  }, [queryClient]);

  /**
   * الجلسة الحالية.
   *
   * ── لماذا نسأل الخادم بدل قراءة رمز محلي؟ ────────────────────────────────
   * لا نملك الرمز أصلًا (كوكي HttpOnly). وهذا **ميزة** لا قيد: مصدر الحقيقة
   * الوحيد لحالة الجلسة هو الخادم. لو أُبطلت الجلسة (خروج من جهاز آخر، كشف
   * سرقة، تعطيل الحساب)، يعرف التطبيق فورًا عند أول طلب — لا يظل يعرض واجهة
   * «مسجّل الدخول» بناءً على رمز في localStorage لم يعد صالحًا.
   */
  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<SessionUser>('/auth/me'),

    /**
     * ⚠️ لا إعادة محاولة إطلاقًا — وهذا مقصود.
     *
     * هذا استعلام **استطلاع جلسة**، لا جلب بيانات. فشله بأي سبب (401 لزائر،
     * أو 500 لخادم متوقف، أو انقطاع شبكة) يعني عمليًا شيئًا واحدًا: «لا جلسة».
     *
     * لو أعدنا المحاولة، لظلت `isLoading` صادقة أثناء المحاولات — و`RequireAuth`
     * يعرض دوّار «جارٍ التحقق من الجلسة» طوال تلك المدة. النتيجة: زائر يفتح
     * الموقع بينما الخادم بطيء يحدّق في دوّار **قبل أن يرى شاشة الدخول أصلًا**.
     *
     * (كشفت هذا لقطةُ شاشة، لا الاختبارات: Playwright ينتظر `networkidle`
     *  فيتجاوز فترة الانتظار تلقائيًا ولا «يرى» الدوّار.)
     *
     * الجلسة الحقيقية تُستعاد بمسار التجديد عند أول طلب موثّق، لا بإلحاح هنا.
     */
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginRequest) => api.post<LoginResponse>('/auth/login', credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSettled: () => {
      // نمسح **كل** الذاكرة المؤقتة عند الخروج.
      // ⚠️ لولا ذلك لبقيت بيانات المحل السابق في الذاكرة، وقد تومض على شاشة
      //    المستخدم التالي على نفس الجهاز قبل وصول بياناته — تسرّب بصري حقيقي.
      queryClient.clear();
    },
  });

  const supportMutation = useMutation({
    mutationFn: (tenantId: string) =>
      api.post<LoginResponse>(`/platform/tenants/${tenantId}/support-session`),
    onSuccess: (data) => {
      queryClient.clear();
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });

  const exitSupportMutation = useMutation({
    mutationFn: () => api.post<LoginResponse>('/auth/support/exit'),
    onSuccess: (data) => {
      queryClient.clear();
      queryClient.setQueryData(['auth', 'me'], data.user);
    },
  });

  const login = useCallback(
    (credentials: LoginRequest) => loginMutation.mutateAsync(credentials),
    [loginMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const enterTenantSupport = useCallback(
    (tenantId: string) => supportMutation.mutateAsync(tenantId),
    [supportMutation],
  );

  const exitTenantSupport = useCallback(
    () => exitSupportMutation.mutateAsync(),
    [exitSupportMutation],
  );

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user]);

  /**
   * فحص الصلاحية في الواجهة.
   *
   * ⚠️ هذا **تحسين تجربة** لا حماية. إخفاء زر لا يمنع أحدًا من استدعاء الـAPI
   *    مباشرة. الحماية الحقيقية في `PermissionsGuard` على الخادم، ولا شيء
   *    غيرها. لو حُذف هذا الملف كله، لظل النظام آمنًا — أقبح فقط.
   */
  const can = useCallback((permission: Permission) => permissions.has(permission), [permissions]);

  const canAny = useCallback(
    (...list: Permission[]) => list.some((p) => permissions.has(p)),
    [permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: isError ? null : (user ?? null),
      isLoading,
      isAuthenticated: !isError && Boolean(user),
      login,
      logout,
      enterTenantSupport,
      exitTenantSupport,
      can,
      canAny,
    }),
    [user, isLoading, isError, login, logout, enterTenantSupport, exitTenantSupport, can, canAny],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth يجب أن يُستخدم داخل <AuthProvider>.');
  }
  return context;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

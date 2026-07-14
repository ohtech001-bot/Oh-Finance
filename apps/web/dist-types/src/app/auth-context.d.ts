import type { LoginRequest, LoginResponse, SessionUser } from '@oh/contracts';
import type { Permission } from '@oh/config';
interface AuthContextValue {
    user: SessionUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (credentials: LoginRequest) => Promise<LoginResponse>;
    logout: () => Promise<void>;
    /** هل يملك المستخدم الصلاحية؟ **للتجربة فقط** — لا يحل محل فحص الخادم. */
    can: (permission: Permission) => boolean;
    canAny: (...permissions: Permission[]) => boolean;
}
export declare function AuthProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useAuth(): AuthContextValue;
export {};
//# sourceMappingURL=auth-context.d.ts.map
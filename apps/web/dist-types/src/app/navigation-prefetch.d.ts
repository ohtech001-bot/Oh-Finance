import { type QueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@oh/contracts';
export declare function prefetchNavigationData(client: QueryClient, user: SessionUser | null, path: string): Promise<void>;
export declare function useNavigationPrefetch(): (path: string) => void;
//# sourceMappingURL=navigation-prefetch.d.ts.map
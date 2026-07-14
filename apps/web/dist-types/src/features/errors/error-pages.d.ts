import { Component, type ErrorInfo, type ReactNode } from 'react';
export declare function NotFoundPage(): import("react").JSX.Element;
export declare function ForbiddenPage(): import("react").JSX.Element;
export declare function RouteErrorPage(): import("react").JSX.Element;
interface ErrorBoundaryState {
    error: Error | null;
}
/**
 * حدّ الأخطاء الجذري.
 *
 * بدونه، خطأ عرض واحد في أي مكوّن يُفرغ الشاشة إلى **بياض تام** — بلا رسالة،
 * بلا مخرج، بلا حتى زر تحديث. المستخدم يظن أن التطبيق تعطّل وأن بياناته ضاعت.
 *
 * React لا يوفّر نسخة hook من هذا؛ الصنف (class) هو الطريقة الوحيدة.
 */
export declare class AppErrorBoundary extends Component<{
    children: ReactNode;
}, ErrorBoundaryState> {
    state: ErrorBoundaryState;
    static getDerivedStateFromError(error: Error): ErrorBoundaryState;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    render(): ReactNode;
}
export {};
//# sourceMappingURL=error-pages.d.ts.map
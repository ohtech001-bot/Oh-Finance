export interface AuthLayoutProps {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{
        className?: string;
    }>;
    children: React.ReactNode;
}
export declare function AuthLayout({ title, subtitle, icon: Icon, children }: AuthLayoutProps): import("react").JSX.Element;
//# sourceMappingURL=auth-layout.d.ts.map
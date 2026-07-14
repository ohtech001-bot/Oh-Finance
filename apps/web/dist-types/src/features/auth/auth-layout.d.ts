export interface AuthLayoutProps {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{
        className?: string;
    }>;
    children: React.ReactNode;
}
/**
 * تخطيط شاشات المصادقة.
 *
 * لوحان: البطاقة (المحتوى) + لوحة العلامة. تنهار إلى عمود واحد تحت 1024px.
 *
 * مبدّل اللغة حاضر **قبل** تسجيل الدخول عمدًا: مستخدم يتحدث العبرية يجب أن
 * يستطيع قراءة شاشة الدخول نفسها. وضعه داخل التطبيق فقط يعني أن أول شاشة
 * يراها بلغة لا يفهمها.
 */
export declare function AuthLayout({ title, subtitle, icon: Icon, children }: AuthLayoutProps): import("react").JSX.Element;
//# sourceMappingURL=auth-layout.d.ts.map
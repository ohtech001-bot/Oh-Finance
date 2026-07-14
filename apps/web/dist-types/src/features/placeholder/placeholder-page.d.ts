import type { LucideIcon } from 'lucide-react';
export interface PlaceholderPageProps {
    titleKey: string;
    icon: LucideIcon;
    description: string;
    phase: string;
}
/**
 * صفحة قسم لم يُبنَ بعد.
 *
 * ليست «صفحة فارغة»: تحمل ترويسة الصفحة الحقيقية (العنوان، الأيقونة، فُتات
 * الخبز) وتقع داخل الهيكل الكامل — فالمستخدم يرى **بالضبط** أين ستكون
 * الشاشة، ويعرف متى تصل.
 *
 * البديل — إخفاء العنصر من الشريط الجانبي حتى يجهز — كان سيُخفي خارطة النظام
 * عن المستخدم ويجعل كل مرحلة تبدو وكأنها تغيّر التطبيق فجأة.
 */
export declare function PlaceholderPage({ titleKey, icon, description, phase }: PlaceholderPageProps): import("react").JSX.Element;
//# sourceMappingURL=placeholder-page.d.ts.map
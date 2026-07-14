import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { PageHeader, PendingFeatureState } from '@oh/ui';

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
export function PlaceholderPage({ titleKey, icon, description, phase }: PlaceholderPageProps) {
  const { t } = useTranslation();
  const title = t(titleKey);

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        icon={icon}
        breadcrumbs={[{ label: t('nav.dashboard'), href: '/' }, { label: title }]}
        linkAs={Link}
      />

      <PendingFeatureState title={title} description={description} phase={phase} />
    </div>
  );
}

import { Outlet } from 'react-router-dom';
import { useGlobalShortcuts } from '@/lib/use-global-shortcuts';

/**
 * طبقة تنسيق شفافة تفعّل اختصارات لوحة المفاتيح العامة داخل منطقة المحل.
 *
 * مُنفصلة عن `AppShell` عمدًا: لا نلمس القشرة ولا الشريط الجانبي ولا العلوي.
 * تُركَّب كطبقة أب في جدول المسارات فقط.
 */
export function ShortcutsLayout() {
  useGlobalShortcuts();
  return <Outlet />;
}

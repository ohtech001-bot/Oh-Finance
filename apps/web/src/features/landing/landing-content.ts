import {
  Users,
  ShoppingBag,
  Wallet,
  ListOrdered,
  ChartNoAxesCombined,
  UserRoundCog,
  KeyRound,
  DatabaseBackup,
  ShieldCheck,
  LayoutDashboard,
  Settings,
} from 'lucide-react';

export const SUBSCRIPTION_MESSAGE =
  'مرحبًا O&H Tech، اطلعت على منظومة OH Finance وأرغب بالاشتراك. أرجو تزويدي بتفاصيل الاشتراك.';
export const SUBSCRIPTION_URL = `https://wa.me/972552616622?text=${encodeURIComponent(SUBSCRIPTION_MESSAGE)}`;

export const SECTIONS = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'about', label: 'عن المنظومة' },
  { id: 'features', label: 'المميزات' },
  { id: 'how-it-works', label: 'كيف تعمل؟' },
  { id: 'contact', label: 'تواصل معنا' },
] as const;

export const FEATURES = [
  {
    icon: Users,
    title: 'إدارة الزبائن',
    text: 'معلومات الزبون، رصيده، حد الدين وموعد السداد في ملف واحد.',
    tone: 'green',
  },
  {
    icon: ShoppingBag,
    title: 'إدارة الطلبات',
    text: 'من المسودة إلى التأكيد، مع تفاصيل المنتجات وحالة السداد.',
    tone: 'blue',
  },
  {
    icon: Wallet,
    title: 'متابعة الدفعات',
    text: 'سجّل المقبوضات وتابع السداد الكامل والجزئي لكل طلب.',
    tone: 'gold',
  },
  {
    icon: ListOrdered,
    title: 'الحساب والحركات',
    text: 'تتبّع الدين والرصيد والعمليات المرتبطة بكل حساب.',
    tone: 'blue',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'التقارير المالية',
    text: 'نظرة أوضح على الطلبات والديون والزبائن المستحق عليهم السداد.',
    tone: 'green',
  },
  {
    icon: UserRoundCog,
    title: 'إدارة الموظفين',
    text: 'أضف فريق العمل وحدّث بياناته وحالة الوصول إلى المنظومة.',
    tone: 'gold',
  },
  {
    icon: KeyRound,
    title: 'صلاحيات محددة',
    text: 'كل مستخدم يصل إلى الأقسام والإجراءات المسموح بها لدوره.',
    tone: 'gold',
  },
  {
    icon: DatabaseBackup,
    title: 'تجهيز النسخ الاحتياطي',
    text: 'أدوات لنسخ مستقل ومشفّر، تُفعّل حسب إعدادات الاستضافة.',
    tone: 'blue',
  },
  {
    icon: ShieldCheck,
    title: 'حماية بيانات العمل',
    text: 'عزل بيانات المحلات وحماية الجلسات والتحقق من الصلاحيات.',
    tone: 'green',
  },
] as const;

export const SCREENS = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { id: 'customers', label: 'الزبائن', icon: Users },
  { id: 'orders', label: 'الطلبات', icon: ShoppingBag },
  { id: 'ledger', label: 'الحساب والحركات', icon: ListOrdered },
  { id: 'reports', label: 'التقارير', icon: ChartNoAxesCombined },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
] as const;

export const STEPS = [
  { title: 'إنشاء حساب العمل', text: 'تواصل معنا لتجهيز حساب محلك ومعلوماته الأساسية.' },
  { title: 'إضافة الزبائن', text: 'نظّم معلومات الزبائن وحدود الدين ومواعيد السداد.' },
  { title: 'تسجيل الطلبات والدفعات', text: 'سجّل العمليات اليومية وتابع حالة كل طلب.' },
  { title: 'متابعة الحسابات والتقارير', text: 'راجع الأرصدة والديون واتخذ خطواتك على صورة أوضح.' },
] as const;

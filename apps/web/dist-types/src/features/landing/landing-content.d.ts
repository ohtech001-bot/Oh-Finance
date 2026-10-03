export declare const SUBSCRIPTION_MESSAGE = "\u0645\u0631\u062D\u0628\u064B\u0627 O&H Tech\u060C \u0627\u0637\u0644\u0639\u062A \u0639\u0644\u0649 \u0645\u0646\u0638\u0648\u0645\u0629 OH Finance \u0648\u0623\u0631\u063A\u0628 \u0628\u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643. \u0623\u0631\u062C\u0648 \u062A\u0632\u0648\u064A\u062F\u064A \u0628\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643.";
export declare const SUBSCRIPTION_URL: string;
export declare const SECTIONS: readonly [{
    readonly id: "home";
    readonly label: "الرئيسية";
}, {
    readonly id: "about";
    readonly label: "عن المنظومة";
}, {
    readonly id: "features";
    readonly label: "المميزات";
}, {
    readonly id: "how-it-works";
    readonly label: "كيف تعمل؟";
}, {
    readonly id: "contact";
    readonly label: "تواصل معنا";
}];
export declare const FEATURES: readonly [{
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "إدارة الزبائن";
    readonly text: "معلومات الزبون، رصيده، حد الدين وموعد السداد في ملف واحد.";
    readonly tone: "green";
}, {
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "إدارة الطلبات";
    readonly text: "من المسودة إلى التأكيد، مع تفاصيل المنتجات وحالة السداد.";
    readonly tone: "blue";
}, {
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "متابعة الدفعات";
    readonly text: "سجّل المقبوضات وتابع السداد الكامل والجزئي لكل طلب.";
    readonly tone: "gold";
}, {
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "الحساب والحركات";
    readonly text: "تتبّع الدين والرصيد والعمليات المرتبطة بكل حساب.";
    readonly tone: "blue";
}, {
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "التقارير المالية";
    readonly text: "نظرة أوضح على الطلبات والديون والزبائن المستحق عليهم السداد.";
    readonly tone: "green";
}, {
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "إدارة الموظفين";
    readonly text: "أضف فريق العمل وحدّث بياناته وحالة الوصول إلى المنظومة.";
    readonly tone: "gold";
}, {
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "صلاحيات محددة";
    readonly text: "كل مستخدم يصل إلى الأقسام والإجراءات المسموح بها لدوره.";
    readonly tone: "gold";
}, {
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "تجهيز النسخ الاحتياطي";
    readonly text: "أدوات لنسخ مستقل ومشفّر، تُفعّل حسب إعدادات الاستضافة.";
    readonly tone: "blue";
}, {
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
    readonly title: "حماية بيانات العمل";
    readonly text: "عزل بيانات المحلات وحماية الجلسات والتحقق من الصلاحيات.";
    readonly tone: "green";
}];
export declare const SCREENS: readonly [{
    readonly id: "dashboard";
    readonly label: "لوحة التحكم";
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
}, {
    readonly id: "customers";
    readonly label: "الزبائن";
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
}, {
    readonly id: "orders";
    readonly label: "الطلبات";
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
}, {
    readonly id: "ledger";
    readonly label: "الحساب والحركات";
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
}, {
    readonly id: "reports";
    readonly label: "التقارير";
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
}, {
    readonly id: "settings";
    readonly label: "الإعدادات";
    readonly icon: import("react").ForwardRefExoticComponent<Omit<import("lucide-react").LucideProps, "ref"> & import("react").RefAttributes<SVGSVGElement>>;
}];
export declare const STEPS: readonly [{
    readonly title: "إنشاء حساب العمل";
    readonly text: "تواصل معنا لتجهيز حساب محلك ومعلوماته الأساسية.";
}, {
    readonly title: "إضافة الزبائن";
    readonly text: "نظّم معلومات الزبائن وحدود الدين ومواعيد السداد.";
}, {
    readonly title: "تسجيل الطلبات والدفعات";
    readonly text: "سجّل العمليات اليومية وتابع حالة كل طلب.";
}, {
    readonly title: "متابعة الحسابات والتقارير";
    readonly text: "راجع الأرصدة والديون واتخذ خطواتك على صورة أوضح.";
}];
//# sourceMappingURL=landing-content.d.ts.map
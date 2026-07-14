import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
export declare function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export declare function CardHeader({ title, action, className, ...props }: React.HTMLAttributes<HTMLDivElement> & {
    title: string;
    action?: React.ReactNode;
}): import("react").JSX.Element;
export declare function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): import("react").JSX.Element;
export interface AvatarProps {
    src?: string | null;
    name: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}
/**
 * الصورة الرمزية مع بديل بالأحرف الأولى.
 *
 * `initials` تأخذ أول حرف من أول كلمتين — يعمل مع العربية والعبرية
 * والإنجليزية. Radix يتكفّل بعرض البديل تلقائيًا إن فشل تحميل الصورة،
 * فلا تظهر أيقونة صورة مكسورة أبدًا.
 */
export declare function Avatar({ src, name, size, className }: AvatarProps): import("react").JSX.Element;
export declare const DropdownMenu: import("react").FC<DropdownMenuPrimitive.DropdownMenuProps>;
export declare const DropdownMenuTrigger: import("react").ForwardRefExoticComponent<DropdownMenuPrimitive.DropdownMenuTriggerProps & import("react").RefAttributes<HTMLButtonElement>>;
export declare const DropdownMenuGroup: import("react").ForwardRefExoticComponent<DropdownMenuPrimitive.DropdownMenuGroupProps & import("react").RefAttributes<HTMLDivElement>>;
export declare const DropdownMenuContent: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuContentProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const DropdownMenuItem: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuItemProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & {
    destructive?: boolean;
} & import("react").RefAttributes<HTMLDivElement>>;
export declare const DropdownMenuLabel: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuLabelProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const DropdownMenuSeparator: import("react").ForwardRefExoticComponent<Omit<DropdownMenuPrimitive.DropdownMenuSeparatorProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const Separator: import("react").ForwardRefExoticComponent<Omit<SeparatorPrimitive.SeparatorProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const Switch: import("react").ForwardRefExoticComponent<Omit<SwitchPrimitive.SwitchProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export declare const Tabs: import("react").ForwardRefExoticComponent<TabsPrimitive.TabsProps & import("react").RefAttributes<HTMLDivElement>>;
export declare const TabsList: import("react").ForwardRefExoticComponent<Omit<TabsPrimitive.TabsListProps & import("react").RefAttributes<HTMLDivElement>, "ref"> & import("react").RefAttributes<HTMLDivElement>>;
export declare const TabsTrigger: import("react").ForwardRefExoticComponent<Omit<TabsPrimitive.TabsTriggerProps & import("react").RefAttributes<HTMLButtonElement>, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export declare const TabsContent: import("react").ForwardRefExoticComponent<TabsPrimitive.TabsContentProps & import("react").RefAttributes<HTMLDivElement>>;
//# sourceMappingURL=misc.d.ts.map
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { forwardRef } from 'react';
import { cn } from '../lib/cn.js';

// ── البطاقة ──────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-card border border-border bg-card shadow-card', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { title: string; action?: React.ReactNode }) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 px-5 py-4', className)}
      {...props}
    >
      <h2 className="text-card-title text-fg">{title}</h2>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />;
}

// ── الصورة الرمزية ───────────────────────────────────────────────────────────

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
export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('');

  const sizeClass = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg' }[size];

  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full bg-accent-soft',
        sizeClass,
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center font-semibold text-accent">
        {initials || '؟'}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

// ── القائمة المنسدلة ─────────────────────────────────────────────────────────

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[200px] overflow-hidden rounded-card border border-border bg-card p-1.5 shadow-pop',
        'data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }
>(({ className, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2.5 rounded-ctrl px-3 py-2 text-sm outline-none',
      'transition-colors focus:bg-card-muted',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      '[&_svg]:size-4 [&_svg]:shrink-0',
      destructive ? 'text-danger focus:bg-danger-soft' : 'text-fg',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('px-3 py-2 text-xs font-semibold text-fg-muted', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1.5 my-1.5 h-px bg-border', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

// ── الفاصل ───────────────────────────────────────────────────────────────────

export const Separator = forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
));
Separator.displayName = 'Separator';

// ── المفتاح ──────────────────────────────────────────────────────────────────

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
      'border-2 border-transparent transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-brand data-[state=unchecked]:bg-border',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform',
        // منطقي: في RTL ينزلق الإبهام إلى اليسار عند التفعيل.
        'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        'rtl:data-[state=checked]:-translate-x-5',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

// ── التبويبات ────────────────────────────────────────────────────────────────

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('flex items-center gap-1 border-b border-border', className)}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative px-4 py-3 text-sm font-medium text-fg-muted transition-colors',
      'hover:text-fg',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      // الخط السفلي للتبويب النشط — كما في «صفحة كل زبون».
      'data-[state=active]:text-accent',
      'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent',
      'data-[state=active]:after:bg-accent',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = TabsPrimitive.Content;

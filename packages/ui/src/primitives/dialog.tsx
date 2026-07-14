import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '../lib/cn.js';
import { Button } from './button.js';

/**
 * الحوارات والدرج — مبنية على Radix.
 *
 * ── لماذا Radix وليس <dialog> أو تنفيذ يدوي؟ ─────────────────────────────────
 * الحوار الصحيح يتطلب: حبس التركيز داخله، إعادة التركيز إلى الزر المُطلِق عند
 * الإغلاق، إغلاق بـEsc، `aria-modal`، إخفاء بقية الصفحة عن قارئ الشاشة، ومنع
 * تمرير الخلفية. كل بند منها يُنسى بسهولة في تنفيذ يدوي، والنتيجة حوار لا
 * يستطيع مستخدم لوحة المفاتيح الخروج منه — سجن.
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm',
      'data-[state=open]:animate-fade-in',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: 'sm' | 'md' | 'lg' | 'xl' }
>(({ className, children, size = 'md', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed start-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2',
        'rounded-card border border-border bg-card shadow-pop',
        'max-h-[calc(100vh-4rem)] overflow-y-auto',
        'data-[state=open]:animate-fade-in',
        { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size],
        className,
      )}
      {...props}
    >
      {children}

      <DialogPrimitive.Close
        className={cn(
          'absolute end-4 top-4 rounded-ctrl p-1.5 text-fg-muted transition-colors',
          'hover:bg-card-muted hover:text-fg',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <X className="size-4" />
        <span className="sr-only">إغلاق</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = 'DialogContent';

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-border px-6 py-4 pe-14', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-start',
        className,
      )}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-5', className)} {...props} />;
}

export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-card-title text-fg', className)} {...props} />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('mt-1 text-sm text-fg-muted', className)}
    {...props}
  />
));
DialogDescription.displayName = 'DialogDescription';

// ── الدرج (Drawer / Sheet) ───────────────────────────────────────────────────

/**
 * درج منزلق من حافة البداية (يمين في RTL، يسار في LTR).
 * يُستخدم للقائمة الجانبية على الموبايل ولنماذج الفلترة المتقدمة.
 */
export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export const DrawerContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: 'start' | 'end';
  }
>(({ className, children, side = 'start', ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-y-0 z-50 flex w-[300px] max-w-[85vw] flex-col bg-card shadow-pop',
        'data-[state=open]:animate-slide-in-start',
        // خصائص منطقية: تنعكس تلقائيًا مع dir.
        side === 'start' ? 'start-0 border-e border-border' : 'end-0 border-s border-border',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          'absolute end-4 top-4 rounded-ctrl p-1.5 text-fg-muted',
          'hover:bg-card-muted hover:text-fg',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <X className="size-4" />
        <span className="sr-only">إغلاق القائمة</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DrawerContent.displayName = 'DrawerContent';

// ── حوار التأكيد ─────────────────────────────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'brand';
  loading?: boolean;
  onConfirm: () => void;
}

/**
 * حوار التأكيد — إلزامي قبل كل عملية غير قابلة للتراجع.
 *
 * في هذا النظام: إلغاء طلب مؤكد، عكس دفعة، إغلاق دورة حساب، إيقاف محل.
 *
 * ⚠️ زر التأكيد **ليس** المُركَّز افتراضيًا. المستخدم الذي يضغط Enter بعادةٍ
 *    لا ينفّذ الإجراء الخطر بالخطأ — عليه أن يصل إليه بوعي.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  variant = 'danger',
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              {cancelLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

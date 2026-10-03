import { forwardRef, useId } from 'react';
import { cn } from '../lib/cn.js';
import { useUiTranslation } from '../localization.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** أيقونة في بداية الحقل (RTL: على اليمين — تلقائيًا). */
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, startIcon, endIcon, error, type = 'text', ...props }, ref) => (
    <div className="relative w-full">
      {startIcon ? (
        <span
          className="text-fg-subtle pointer-events-none absolute inset-y-0 start-3 flex items-center"
          aria-hidden
        >
          {startIcon}
        </span>
      ) : null}

      <input
        ref={ref}
        type={type}
        className={cn(
          'rounded-ctrl bg-card text-fg h-11 w-full border px-3 text-sm',
          'placeholder:text-fg-subtle',
          'transition-colors',
          'focus-visible:ring-ring focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2',
          'disabled:bg-card-muted disabled:cursor-not-allowed disabled:opacity-50',
          // خصائص منطقية (ps/pe) — تنعكس تلقائيًا في RTL/LTR.
          startIcon && 'ps-10',
          endIcon && 'pe-10',
          error ? 'border-danger focus-visible:ring-danger' : 'border-border',
          className,
        )}
        aria-invalid={error || undefined}
        {...props}
      />

      {endIcon ? (
        <span className="text-fg-subtle absolute inset-y-0 end-3 flex items-center">{endIcon}</span>
      ) : null}
    </div>
  ),
);
Input.displayName = 'Input';

// ── حقل نموذج كامل: تسمية + حقل + خطأ + وصف ────────────────────────────────

export interface FieldRenderProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: FieldRenderProps) => React.ReactNode;
}

/**
 * حقل نموذج موصول بالكامل للوصول.
 *
 * الربط بـ`aria-describedby` ليس تجميلًا: قارئ الشاشة يجب أن يُعلن رسالة
 * الخطأ عند الوصول للحقل. حقل أحمر بلا هذا الربط لا يعني شيئًا لمستخدم كفيف
 * — يسمع «حقل نصي» فقط، ولا يعرف لماذا رُفض نموذجه.
 */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const copy = useUiTranslation();
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-fg block text-[13px] font-medium">
        {copy(label)}
        {/*
          ⚠️ النجمة `aria-hidden`، والإلزام يُبلَّغ عبر `aria-required` على الحقل.

          لو حملت النجمة `aria-label="مطلوب"`، لالتصقت بنص التسمية في الاسم
          الوصولي: قارئ الشاشة ينطق «البريد الإلكترونيمطلوب» — كلمة واحدة
          ملتصقة، لا معنى لها. الصحيح أن يُعلن الإلزام كخاصية للحقل، لا كجزء
          من اسمه.
        */}
        {required ? (
          <span className="text-danger ms-1" aria-hidden>
            *
          </span>
        ) : null}
      </label>

      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
        'aria-required': required || undefined,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-fg-muted text-xs">
          {copy(hint)}
        </p>
      ) : null}

      {error ? (
        // role="alert" يجعل قارئ الشاشة يُعلن الخطأ فور ظهوره.
        <p id={errorId} role="alert" className="text-danger text-xs font-medium">
          {copy(error)}
        </p>
      ) : null}
    </div>
  );
}

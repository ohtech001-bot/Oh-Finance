import { ChevronDown, FileText, Printer, ReceiptText } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from '@oh/ui';
import type { PrintPaperSize } from './print-order';
import { currentLocale } from '@/lib/i18n';

const COPY = {
  ar: { print: 'طباعة الطلب', thermal: 'طابعة حرارية 80 مم', a4: 'ورقة A4' },
  he: { print: 'הדפסת הזמנה', thermal: 'מדפסת תרמית 80 מ״מ', a4: 'דף A4' },
  en: { print: 'Print order', thermal: '80 mm thermal printer', a4: 'A4 paper' },
} as const;

export function PrintOrderMenu({
  onSelect,
  compact = false,
  className,
}: {
  onSelect: (paperSize: PrintPaperSize) => void;
  compact?: boolean;
  className?: string;
}) {
  const copy = COPY[currentLocale()];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? 'sm' : 'md'} className={cn(className)}>
          <Printer aria-hidden />
          {copy.print}
          <ChevronDown className="ms-auto" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onSelect('80mm')}>
          <ReceiptText aria-hidden />
          {copy.thermal}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect('A4')}>
          <FileText aria-hidden />
          {copy.a4}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

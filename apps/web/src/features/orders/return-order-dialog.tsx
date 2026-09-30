import { useState } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { sum, type CurrencyCode } from '@oh/money';
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MoneyText,
  toast,
} from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { ApiRequestError } from '@/lib/api';
import { currentLocale } from '@/lib/i18n';
import { useOrder, useOrders, useReturnOrder } from './api';
import { displayOrderNumber } from './order-number';

export function ReturnOrderDialog({
  customerId,
  open,
  onOpenChange,
}: {
  customerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const he = currentLocale() === 'he';
  const text = he
    ? {
        title: 'החזרת הזמנה',
        back: 'חזרה',
        empty: 'אין הזמנות עם יתרה לתשלום.',
        loading: 'טוען...',
        error: 'טעינת ההזמנות נכשלה.',
        retry: 'נסה שוב',
        all: 'החזרת כל המוצרים שנותרו',
        amount: 'סכום הזיכוי',
        confirm: 'האם להחזיר את המוצרים שנבחרו מההזמנה?',
        hint: 'הסכום יופחת מהחוב. הפרש מעבר לחוב יישמר כיתרת זכות ללקוח.',
        done: 'ההחזרה נרשמה וחשבון הלקוח עודכן.',
        cancel: 'ביטול',
        next: 'הבא',
        prev: 'הקודם',
      }
    : {
        title: 'إرجاع طلبية',
        back: 'رجوع',
        empty: 'لا توجد طلبيات غير مسددة.',
        loading: 'جارٍ التحميل...',
        error: 'تعذر تحميل الطلبات.',
        retry: 'إعادة المحاولة',
        all: 'إرجاع جميع المنتجات المتبقية',
        amount: 'قيمة الإرجاع',
        confirm: 'هل تريد إرجاع الطلبية أو المنتجات المحددة منها؟',
        hint: 'تُخصم القيمة من الدين، ويصبح الفرق الزائد عن الدين رصيدًا للزبون.',
        done: 'تم الإرجاع وتحديث حساب الزبون.',
        cancel: 'إلغاء',
        next: 'التالي',
        prev: 'السابق',
      };
  const { user } = useAuth();
  const currency = (user?.store?.currency ?? 'ILS') as CurrencyCode;
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string>();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const list = useOrders({ customerId, unpaidOnly: true, page, pageSize: 10 }, open && !selectedId);
  const detail = useOrder(open ? selectedId : undefined);
  const order = detail.data;
  const mutation = useReturnOrder();
  const available = order?.items.filter((item) => !item.returned) ?? [];
  const amount = sum(
    available
      .filter((item) => selected.includes(item.id))
      .map((item) => item.returnableAmount ?? '0'),
  );
  const changeSelection = (ids: string[]) => {
    setSelected(ids);
    setRequestId(crypto.randomUUID());
  };
  const close = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) {
      setSelectedId(undefined);
      setSelected([]);
      setPage(1);
      setConfirmation(false);
    }
    onOpenChange(next);
  };
  const submit = () => {
    if (!order || !selected.length || mutation.isPending) return;
    mutation.mutate(
      { id: order.id, body: { version: order.version, requestId, itemIds: selected } },
      {
        onSuccess: () => {
          toast.success(text.done);
          setConfirmation(false);
          setSelectedId(undefined);
          setSelected([]);
        },
        onError: (error) => {
          toast.error(error instanceof ApiRequestError ? error.message : text.error);
          setConfirmation(false);
          void detail.refetch();
        },
      },
    );
  };
  const activeQuery = selectedId ? detail : list;
  return (
    <>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.title}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {selectedId && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedId(undefined);
                  setSelected([]);
                }}
              >
                <ArrowRight aria-hidden />
                {text.back}
              </Button>
            )}
            {activeQuery.isLoading ? (
              <p role="status">{text.loading}</p>
            ) : activeQuery.isError ? (
              <div role="alert">
                <p>{text.error}</p>
                <Button onClick={() => void activeQuery.refetch()}>{text.retry}</Button>
              </div>
            ) : selectedId && order ? (
              <div className="space-y-3">
                <h3 className="font-semibold">{displayOrderNumber(order.number)}</h3>
                <label className="border-border flex items-center gap-2 border-b py-3">
                  <input
                    type="checkbox"
                    checked={available.length > 0 && selected.length === available.length}
                    onChange={(event) =>
                      changeSelection(event.target.checked ? available.map((item) => item.id) : [])
                    }
                  />
                  {text.all}
                </label>
                {available.map((item) => (
                  <label
                    key={item.id}
                    className="border-border flex items-center gap-3 border-b py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(event) =>
                        changeSelection(
                          event.target.checked
                            ? [...selected, item.id]
                            : selected.filter((id) => id !== item.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 break-words">
                      {item.name} <span className="text-fg-muted">× {item.quantity}</span>
                    </span>
                    <MoneyText
                      value={item.returnableAmount ?? '0'}
                      currency={currency}
                      tone="plain"
                    />
                  </label>
                ))}
                <div className="flex justify-between gap-3 font-semibold">
                  <span>{text.amount}</span>
                  <MoneyText value={amount.toString()} currency={currency} tone="credit" />
                </div>
                <p className="text-fg-muted text-sm">{text.hint}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {list.data?.items.length === 0 && <p>{text.empty}</p>}
                {list.data?.items.map((item) => (
                  <Button
                    key={item.id}
                    variant="outline"
                    className="h-auto w-full justify-between gap-3 py-3"
                    onClick={() => {
                      setSelectedId(item.id);
                      changeSelection([]);
                    }}
                  >
                    <span>
                      {displayOrderNumber(item.number)}
                      <span className="text-fg-muted block text-xs" dir="ltr">
                        {item.issuedAt.slice(0, 10)}
                      </span>
                    </span>
                    <MoneyText value={item.remainingAmount} currency={currency} tone="debit" />
                  </Button>
                ))}
                {(list.data?.totalPages ?? 0) > 1 && (
                  <div className="flex justify-between gap-2">
                    <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
                      {text.prev}
                    </Button>
                    <span>
                      {page} / {list.data?.totalPages}
                    </span>
                    <Button
                      disabled={page >= (list.data?.totalPages ?? 1)}
                      onClick={() => setPage(page + 1)}
                    >
                      {text.next}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => close(false)} disabled={mutation.isPending}>
              {text.cancel}
            </Button>
            {order && selectedId && (
              <Button
                variant="brand"
                disabled={!selected.length || mutation.isPending}
                onClick={() => setConfirmation(true)}
              >
                <RotateCcw aria-hidden />
                {text.title}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmation}
        onOpenChange={setConfirmation}
        title={text.confirm}
        description={text.hint}
        confirmLabel={text.title}
        loading={mutation.isPending}
        variant="brand"
        onConfirm={submit}
      />
    </>
  );
}

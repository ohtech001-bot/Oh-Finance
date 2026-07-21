import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CreditCard, Edit3, MessageCircle } from 'lucide-react';
import type {
  PaginatedResult,
  Subscription,
  UpdateSubscriptionBillingRequest,
} from '@oh/contracts';
import { PERMISSIONS } from '@oh/config';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  MoneyText,
  PageHeader,
  toast,
} from '@oh/ui';
import { useAuth } from '@/app/auth-context';
import { api } from '@/lib/api';

export function PlatformSubscriptionsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [form, setForm] = useState<UpdateSubscriptionBillingRequest>({
    currentPeriodStart: '',
    currentPeriodEnd: '',
    agreedMonthlyAmount: '0.00',
    paidAmount: '0.00',
    paymentStatus: 'UNPAID',
  });
  const query = useQuery({
    queryKey: ['platform', 'subscriptions'],
    queryFn: () =>
      api.get<PaginatedResult<Subscription>>('/platform/subscriptions?page=1&pageSize=100'),
  });
  useEffect(() => {
    if (!editing) return;
    setForm({
      currentPeriodStart: editing.currentPeriodStart.slice(0, 10),
      currentPeriodEnd: editing.currentPeriodEnd.slice(0, 10),
      agreedMonthlyAmount: editing.agreedMonthlyAmount,
      paidAmount: editing.paidAmount,
      paymentStatus: editing.paymentStatus,
    });
  }, [editing]);
  const update = useMutation({
    mutationFn: () =>
      api.patch<Subscription>(`/platform/subscriptions/${editing?.id}/billing`, form),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['platform', 'subscriptions'] });
      setEditing(null);
      toast.success(t('subscription.updated'));
    },
  });
  const setStatus = (paymentStatus: UpdateSubscriptionBillingRequest['paymentStatus']) => {
    setForm((current) => ({
      ...current,
      paymentStatus,
      paidAmount:
        paymentStatus === 'UNPAID'
          ? '0.00'
          : paymentStatus === 'PAID'
            ? current.agreedMonthlyAmount
            : current.paidAmount,
    }));
  };

  const reminderLink = (item: Subscription) => {
    if (!item.contactPhone) return null;
    const digits = item.contactPhone.replace(/\D/g, '');
    const phone = digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
    const message = t('subscription.whatsappReminderMessage', {
      name: item.tenantName,
      date: item.currentPeriodEnd.slice(0, 10),
    });
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  const expiresWithinWeek = (item: Subscription) => {
    const remainingMs = new Date(item.currentPeriodEnd).getTime() - Date.now();
    const remainingDays = Math.ceil(remainingMs / 86_400_000);
    return remainingDays >= 0 && remainingDays <= 7;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('subscription.managementTitle')}
        description={t('subscription.managementSubtitle')}
        icon={CreditCard}
      />
      <div className="rounded-card border-border bg-card overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-subtle text-fg-muted">
              <tr>
                <th className="px-4 py-3 text-start">{t('platform.tenantName')}</th>
                <th className="px-4 py-3 text-start">{t('subscription.period')}</th>
                <th className="px-4 py-3 text-start">{t('subscription.agreedAmount')}</th>
                <th className="px-4 py-3 text-start">{t('subscription.paidAmount')}</th>
                <th className="px-4 py-3 text-start">{t('subscription.remainingAmount')}</th>
                <th className="px-4 py-3 text-start">{t('common.status')}</th>
                <th className="px-4 py-3 text-end">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {(query.data?.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium">{item.tenantName}</td>
                  <td className="px-4 py-3 text-start">
                    <span
                      className="inline-grid gap-1 whitespace-nowrap text-xs tabular-nums"
                      dir="ltr"
                    >
                      <span>{item.currentPeriodStart.slice(0, 10)}</span>
                      <span>{item.currentPeriodEnd.slice(0, 10)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <MoneyText
                      value={item.agreedMonthlyAmount}
                      currency={item.plan.currency as 'ILS'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <MoneyText value={item.paidAmount} currency={item.plan.currency as 'ILS'} />
                  </td>
                  <td className="px-4 py-3">
                    <MoneyText
                      value={item.remainingAmount}
                      currency={item.plan.currency as 'ILS'}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {t(`subscription.paymentStatuses.${item.paymentStatus}`)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      {expiresWithinWeek(item) && reminderLink(item) ? (
                        <Button variant="brand" size="sm" asChild>
                          <a
                            href={reminderLink(item) ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle aria-hidden />
                            {t('subscription.sendReminder')}
                          </a>
                        </Button>
                      ) : null}
                      {can(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE) ? (
                        <Button variant="outline" size="sm" onClick={() => setEditing(item)}>
                          <Edit3 aria-hidden />
                          {t('common.edit')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {t('subscription.editBilling')} - {editing?.tenantName}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={t('subscription.startDate')} required>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  dir="ltr"
                  value={form.currentPeriodStart}
                  onChange={(e) => setForm({ ...form, currentPeriodStart: e.target.value })}
                />
              )}
            </Field>
            <Field label={t('subscription.endDate')} required>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  dir="ltr"
                  value={form.currentPeriodEnd}
                  onChange={(e) => setForm({ ...form, currentPeriodEnd: e.target.value })}
                />
              )}
            </Field>
            <Field label={t('subscription.agreedAmount')} required>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={form.agreedMonthlyAmount}
                  onChange={(e) => setForm({ ...form, agreedMonthlyAmount: e.target.value })}
                />
              )}
            </Field>
            <Field label={t('subscription.paymentStatus')} required>
              {(props) => (
                <select
                  {...props}
                  value={form.paymentStatus}
                  onChange={(e) =>
                    setStatus(e.target.value as UpdateSubscriptionBillingRequest['paymentStatus'])
                  }
                  className="rounded-ctrl border-border bg-card h-11 w-full border px-3 text-sm"
                >
                  <option value="UNPAID">{t('subscription.unpaid')}</option>
                  <option value="PARTIAL">{t('subscription.partial')}</option>
                  <option value="PAID">{t('subscription.paid')}</option>
                </select>
              )}
            </Field>
            <Field label={t('subscription.paidAmount')} required>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  disabled={form.paymentStatus !== 'PARTIAL'}
                  value={form.paidAmount}
                  onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                />
              )}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="brand" loading={update.isPending} onClick={() => update.mutate()}>
              {t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

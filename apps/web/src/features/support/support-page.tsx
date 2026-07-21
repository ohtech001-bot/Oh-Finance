import { useTranslation } from 'react-i18next';
import { Headphones, MessageCircle } from 'lucide-react';
import { Button, PageHeader } from '@oh/ui';

const WHATSAPP_URL = 'https://wa.me/972506446682';

export function SupportPage() {
  const { t } = useTranslation();
  return <div className="space-y-6">
    <PageHeader title={t('support.title')} description={t('support.subtitle')} icon={Headphones} />
    <section className="max-w-2xl border-y border-border bg-card px-6 py-8 sm:border sm:p-8">
      <h2 className="text-lg font-semibold text-fg">{t('support.whatsappTitle')}</h2>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{t('support.whatsappDescription')}</p>
      <p className="mt-5 text-xl font-bold text-fg" dir="ltr">0506446682</p>
      <Button asChild variant="brand" className="mt-5">
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle aria-hidden />{t('support.openWhatsapp')}</a>
      </Button>
    </section>
  </div>;
}

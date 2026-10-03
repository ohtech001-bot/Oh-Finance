import { useTranslation } from 'react-i18next';
import { Headphones } from 'lucide-react';
import { Button, PageHeader, WhatsAppIcon } from '@oh/ui';

const WHATSAPP_URL = 'https://wa.me/972506446682';

export function SupportPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('support.title')}
        description={t('support.subtitle')}
        icon={Headphones}
      />
      <section className="border-border bg-card max-w-2xl border-y px-6 py-8 sm:border sm:p-8">
        <h2 className="text-fg text-lg font-semibold">{t('support.whatsappTitle')}</h2>
        <p className="text-fg-muted mt-2 text-sm leading-6">{t('support.whatsappDescription')}</p>
        <p className="text-fg mt-5 text-xl font-bold" dir="ltr">
          0506446682
        </p>
        <Button asChild variant="brand" className="mt-5">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            <WhatsAppIcon aria-hidden />
            {t('support.openWhatsapp')}
          </a>
        </Button>
      </section>
    </div>
  );
}

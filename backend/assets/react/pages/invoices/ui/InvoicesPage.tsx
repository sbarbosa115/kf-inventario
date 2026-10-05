import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 11 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function InvoicesPage() {
  const {t} = useTranslation();
  return <LegacyScreen title={t('nav.invoices')} href={'/admin/invoice/'} />;
}

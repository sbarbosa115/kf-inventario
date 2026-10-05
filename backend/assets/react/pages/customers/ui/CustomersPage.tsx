import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 8 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function CustomersPage() {
  const {t} = useTranslation();
  return <LegacyScreen title={t('nav.customers')} href={'/admin/customer/'} />;
}

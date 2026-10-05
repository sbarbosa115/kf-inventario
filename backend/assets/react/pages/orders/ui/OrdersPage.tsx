import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 9 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function OrdersPage() {
  const {t} = useTranslation();
  return <LegacyScreen title={t('nav.orders')} href={'/admin/order/'} />;
}

import {useParams} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 10 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function OrderGettingReadyPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return (
    <LegacyScreen
      title={t('nav.orders')}
      href={`/admin/order/partial/getting-ready/${id ?? ''}`}
    />
  );
}

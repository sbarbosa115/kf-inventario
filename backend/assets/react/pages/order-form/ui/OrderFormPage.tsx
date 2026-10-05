import {useParams} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 10 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function OrderFormPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return (
    <LegacyScreen
      title={t('nav.orders')}
      href={id ? `/admin/order/edit/${id}` : '/admin/order/new'}
    />
  );
}

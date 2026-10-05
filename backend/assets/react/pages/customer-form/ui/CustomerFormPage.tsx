import {useParams} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 8 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function CustomerFormPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return (
    <LegacyScreen
      title={t('nav.customers')}
      href={id ? `/admin/customer/edit/${id}` : '/admin/customer/new'}
    />
  );
}

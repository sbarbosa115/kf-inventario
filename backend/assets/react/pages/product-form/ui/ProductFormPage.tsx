import {useParams} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 6 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function ProductFormPage() {
  const {t} = useTranslation();
  const {uuid} = useParams();
  return (
    <LegacyScreen
      title={t('nav.products')}
      href={uuid ? `/admin/product/edit/${uuid}` : '/admin/product/new'}
    />
  );
}

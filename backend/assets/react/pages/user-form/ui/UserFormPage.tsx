import {useParams} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 1 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function UserFormPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return (
    <LegacyScreen
      title={t('nav.users')}
      href={id ? `/admin/user/edit/${id}` : '/admin/user/new'}
    />
  );
}

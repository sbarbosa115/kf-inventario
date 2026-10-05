import {useTranslation} from '@/shared/i18n';
import {LegacyScreen} from '@/shared/ui';

/** Until item 1 builds this screen: a link to its legacy page (docs/pdr/prd-restructure.md). */
export function UsersPage() {
  const {t} = useTranslation();
  return <LegacyScreen title={t('nav.users')} href={'/admin/user/'} />;
}

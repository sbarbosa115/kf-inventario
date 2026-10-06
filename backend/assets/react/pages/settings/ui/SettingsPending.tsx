import {useTranslation} from '@/shared/i18n';
import {EmptyState} from '@/shared/ui';

/** A Settings tab another item of shops-settings builds: says so until it lands. */
export function SettingsPending() {
  const {t} = useTranslation();
  return (
    <EmptyState icon="fa-person-digging" message={t('settings.pending')} />
  );
}

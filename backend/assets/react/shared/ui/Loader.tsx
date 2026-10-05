import {useTranslation} from '@/shared/i18n';

export function Loader() {
  const {t} = useTranslation();
  return (
    <div className="d-flex justify-content-center py-4" role="status">
      <div className="spinner-border text-secondary" aria-hidden="true" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

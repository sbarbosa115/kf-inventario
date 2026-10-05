import {Link} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {PageCard} from '@/shared/ui';

export function NotFoundPage() {
  const {t} = useTranslation();
  return (
    <PageCard title={t('errors.notFoundPage.title')}>
      <p>{t('errors.notFoundPage.body')}</p>
      <Link to="/admin/products">{t('errors.notFoundPage.home')}</Link>
    </PageCard>
  );
}

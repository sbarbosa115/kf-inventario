import {useTranslation} from '@/shared/i18n';
import {usePageTitle} from '@/shared/lib';
import {Button} from '@/shared/ui';
import './not-found.css';

/** An address that matches no page, inside the shell: the mark, what happened, the way back. */
export function NotFoundPage() {
  const {t} = useTranslation();
  usePageTitle(t('errors.notFoundPage.title'));
  return (
    <section className="kf-not-found">
      <img src="/images/kf-mark.svg" alt="" width="72" height="72" />
      <h1 className="kf-not-found__title">{t('errors.notFoundPage.title')}</h1>
      <p className="kf-not-found__body">{t('errors.notFoundPage.body')}</p>
      <Button variant="primary" to="/admin/products" icon="fa-arrow-left">
        {t('errors.notFoundPage.home')}
      </Button>
    </section>
  );
}

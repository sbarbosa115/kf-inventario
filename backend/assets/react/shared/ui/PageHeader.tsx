import {useState, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {usePageTitle} from '@/shared/lib';

/**
 * A page's title row: the title (also the browser tab's), a subtitle (a count, the context), the one primary action
 * and the secondary ones (behind "More" on phones), and a way back.
 */
export function PageHeader({
  title,
  subtitle,
  primary,
  secondary,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  /** Where "Back" goes. */
  back?: string;
}) {
  const {t} = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  usePageTitle(title);

  return (
    <header className="kf-page-header">
      <div className="kf-page-header__titles">
        {back && (
          <Link className="kf-page-header__back" to={back}>
            <i className="fas fa-arrow-left" aria-hidden="true" />{' '}
            {t('common.back')}
          </Link>
        )}
        <h1 className="kf-page-header__title">{title}</h1>
        {subtitle && <p className="kf-page-header__subtitle">{subtitle}</p>}
      </div>
      {(primary || secondary) && (
        <div className="kf-page-header__actions">
          {secondary && (
            <>
              <button
                type="button"
                className="kf-btn kf-btn--secondary kf-btn--md kf-page-header__more"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((now) => !now)}
              >
                <span className="kf-btn__label">{t('common.more')}</span>
                <i className="fas fa-chevron-down" aria-hidden="true" />
              </button>
              <div
                className={`kf-page-header__secondary${moreOpen ? ' is-open' : ''}`}
              >
                {secondary}
              </div>
            </>
          )}
          {primary}
        </div>
      )}
    </header>
  );
}

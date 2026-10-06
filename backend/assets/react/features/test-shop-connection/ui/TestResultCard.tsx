import type {ShopTestResult} from '@/entities/shop-connection';
import {useTranslation} from '@/shared/i18n';
import './test-shop-connection.css';

/**
 * What "Test connection" found (docs/pdr/prd-shops-settings.md, "Screen proposals" 3): the store's name and its
 * WooCommerce version, or the shop's error; whether the keys may write (unknown until an update reached the shop,
 * no once one was refused); and the reminder to paste the webhook in the shop.
 */
export function TestResultCard({result}: {result: ShopTestResult}) {
  const {t} = useTranslation();
  const {rest} = result;
  const canWrite =
    rest.can_write === true
      ? 'canWriteYes'
      : rest.can_write === false
        ? 'canWriteNo'
        : 'canWriteUnknown';
  return (
    <section
      className={`kf-test-result ${rest.ok ? 'is-ok' : 'is-failed'}`}
      aria-label={t('shops.test.title')}
    >
      <p className="kf-test-result__headline">
        <i
          className={`fas ${rest.ok ? 'fa-check-circle' : 'fa-times-circle'}`}
          aria-hidden="true"
        />{' '}
        <strong>
          {rest.ok
            ? t('shops.test.ok', {store: rest.store_name ?? '—'})
            : t('shops.test.failed')}
        </strong>
        {rest.ok && rest.wc_version && (
          <span className="kf-test-result__muted">
            {' '}
            · {t('shops.test.version', {version: rest.wc_version})}
          </span>
        )}
      </p>
      {!rest.ok && rest.error && (
        <p className="kf-test-result__error">{rest.error}</p>
      )}
      {rest.ok && <p className="kf-test-result__muted">{t(`shops.test.${canWrite}`)}</p>}
      <p className="kf-test-result__muted">{t('shops.test.webhook')}</p>
    </section>
  );
}

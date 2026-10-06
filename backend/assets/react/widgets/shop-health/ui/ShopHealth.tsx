import {useId, useState} from 'react';
import {Link} from 'react-router-dom';
import {getWebhookSettings} from '@/entities/settings';
import {listShops} from '@/entities/shop-connection';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {shopIssues, type ShopIssue} from '../lib/health';
import './shop-health.css';

function IssueLine({issue}: {issue: ShopIssue}) {
  const {t} = useTranslation();
  return (
    <>
      <span>{issue.text}</span>
      <span aria-hidden="true"> · </span>
      <Link to={issue.href} className="kf-shop-health__link">
        {t('shops.health.fix')}
      </Link>
    </>
  );
}

/**
 * The shops' warning line above the orders (ROLE_ADMIN reads the connections; docs/pdr/prd-shops-settings.md,
 * "Screen proposals" 3): an active connection with orders it could not place, updates that did not reach the shop or
 * a failure newer than its last success, and the old webhook URL reached after it was turned off. One problem is one
 * line with its "Fix in Settings" link; several fold into one line that opens. Nothing at all while every shop is
 * healthy, or when the connections cannot be read (the Orders page is not the place for that error).
 */
export function ShopHealth({refreshKey}: {refreshKey: number}) {
  const {t} = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const shops = useLoad(listShops, [refreshKey]);
  const webhooks = useLoad(getWebhookSettings, [refreshKey]);

  if (!shops.data) return null;
  const issues = shopIssues(shops.data, webhooks.data, t);
  if (issues.length === 0) return null;

  return (
    <section className="kf-shop-health" aria-label={t('shops.health.label')}>
      <i
        className="fas fa-exclamation-triangle kf-shop-health__icon"
        aria-hidden="true"
      />
      {issues.length === 1 ? (
        <p className="kf-shop-health__line">
          <IssueLine issue={issues[0]!} />
        </p>
      ) : (
        <div className="kf-shop-health__body">
          <p className="kf-shop-health__line">
            <span>{t('shops.health.several', {count: issues.length})}</span>{' '}
            <button
              type="button"
              className="kf-shop-health__toggle"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((now) => !now)}
            >
              {open ? t('shops.health.hide') : t('shops.health.show')}
            </button>
          </p>
          <ul className="kf-shop-health__list" id={listId} hidden={!open}>
            {open &&
              issues.map((issue) => (
                <li key={issue.key}>
                  <IssueLine issue={issue} />
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}

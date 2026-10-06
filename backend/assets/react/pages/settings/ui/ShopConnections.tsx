import {useState} from 'react';
import {Link} from 'react-router-dom';
import {getWebhookSettings} from '@/entities/settings';
import {
  deleteShop,
  listShops,
  testShop,
  updateShop,
  type ShopConnection,
  type ShopConnectionPayload,
} from '@/entities/shop-connection';
import {testMessage} from '@/features/test-shop-connection';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {
  Button,
  ConfirmModal,
  EmptyState,
  ErrorState,
  RowMenu,
  Skeleton,
  StatusBadge,
  useToast,
} from '@/shared/ui';
import {
  failureIsCurrent,
  failureLabel,
  legacyIssue,
} from '@/widgets/shop-health';
import './shop-connections.css';

/** The connection as the API takes it back, with a change: keys left out, so the saved ones stay. */
function payloadOf(
  shop: ShopConnection,
  patch: Partial<ShopConnectionPayload>,
): ShopConnectionPayload {
  return {
    name: shop.name,
    site_url: shop.site_url,
    warehouse_id: shop.warehouse.id,
    email_printer: shop.email_printer,
    active: shop.active,
    capabilities: {
      order_status: shop.capabilities.order_status,
      order_note: shop.capabilities.order_note,
    },
    ...patch,
  };
}

function HealthLines({shop}: {shop: ShopConnection}) {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  const {health} = shop;
  const when = (iso: string | null | undefined) =>
    iso ? dateTime(iso) : t('shops.list.never');
  const current = failureIsCurrent(health);
  return (
    <ul className="kf-shop-card__health" aria-label={t('shops.list.health')}>
      <li>
        <span className="kf-shop-card__label">
          {t('shops.list.lastWebhook')}
        </span>
        <span>{when(health.last_webhook_at)}</span>
      </li>
      <li>
        <span className="kf-shop-card__label">
          {t('shops.list.lastImport')}
        </span>
        <span>{when(health.last_import_at)}</span>
      </li>
      <li>
        <span className="kf-shop-card__label">{t('shops.list.lastCheck')}</span>
        <span>{when(health.last_pull_at)}</span>
      </li>
      <li className={current ? 'is-danger' : undefined}>
        <span className="kf-shop-card__label">
          {t('shops.list.lastFailure')}
        </span>
        {health.last_failure_at ? (
          <span>
            {current && (
              <>
                <i
                  className="fas fa-exclamation-circle"
                  aria-hidden="true"
                />{' '}
              </>
            )}
            {dateTime(health.last_failure_at)} ·{' '}
            <strong>{failureLabel(health.last_failure_code, t)}</strong>
            {health.last_failure && (
              <span className="kf-shop-card__reason">
                {health.last_failure}
              </span>
            )}
          </span>
        ) : (
          <span>{t('shops.list.none')}</span>
        )}
      </li>
    </ul>
  );
}

function ShopCard({
  shop,
  onTest,
  onToggle,
  onDelete,
}: {
  shop: ShopConnection;
  onTest: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const {t} = useTranslation();
  const {health} = shop;
  return (
    <article className="kf-shop-card">
      <header className="kf-shop-card__header">
        <div className="kf-shop-card__title">
          <h2 className="kf-shop-card__name">{shop.name}</h2>
          <p className="kf-shop-card__url kf-mono">{shop.site_url}</p>
        </div>
        <RowMenu
          label={t('common.actionsFor', {name: shop.name})}
          actions={[
            {
              label: t('shops.list.edit'),
              icon: 'fa-pen',
              href: `/admin/settings/shops/${shop.id}`,
            },
            {
              label: t('shops.list.test'),
              icon: 'fa-plug',
              onSelect: onTest,
            },
            {
              label: t('shops.list.deliveries'),
              icon: 'fa-inbox',
              href: `/admin/settings/shops/${shop.id}/deliveries`,
            },
            {
              label: shop.active
                ? t('shops.list.deactivate')
                : t('shops.list.activate'),
              icon: shop.active ? 'fa-pause' : 'fa-play',
              onSelect: onToggle,
            },
            {
              label: t('shops.list.delete'),
              icon: 'fa-trash',
              danger: true,
              onSelect: onDelete,
            },
          ]}
        />
      </header>
      <div className="kf-shop-card__facts">
        <StatusBadge tone={shop.active ? 'accent' : 'neutral'}>
          {shop.active ? t('shops.list.active') : t('shops.list.inactive')}
        </StatusBadge>
        {shop.email_printer && (
          <StatusBadge tone="info" icon="fa-print">
            {t('shops.list.prints')}
          </StatusBadge>
        )}
        <span className="kf-shop-card__warehouse">
          <i className="fas fa-warehouse" aria-hidden="true" />{' '}
          <span className="kf-shop-card__label">
            {t('shops.list.warehouse')}
          </span>{' '}
          <strong>{shop.warehouse.name}</strong>
        </span>
      </div>
      <HealthLines shop={shop} />
      {(health.failed_deliveries > 0 || health.failed_pushes > 0) && (
        <p className="kf-shop-card__counters">
          {health.failed_deliveries > 0 && (
            <Link to={`/admin/settings/shops/${shop.id}/deliveries`}>
              <i className="fas fa-inbox" aria-hidden="true" />{' '}
              {t('shops.list.failedDeliveries', {
                count: health.failed_deliveries,
              })}
            </Link>
          )}
          {health.failed_pushes > 0 && (
            <Link to={`/admin/settings/shops/${shop.id}#failed-updates`}>
              <i className="fas fa-cloud-upload-alt" aria-hidden="true" />{' '}
              {t('shops.list.failedUpdates', {count: health.failed_pushes})}
            </Link>
          )}
        </p>
      )}
    </article>
  );
}

/**
 * Settings › Shop connections (ROLE_ADMIN; docs/pdr/prd-shops-settings.md, "Screen proposals" 3): a card per
 * WooCommerce shop with its site, state, warehouse, printing, health and failure counters, and a menu (Edit, Test
 * connection, Failed deliveries, Deactivate/Activate, Delete). A connection orders came from cannot be deleted: the
 * answer offers to deactivate it. Empty, the tab explains the cutover; the old webhook URL reached after it was turned
 * off is a warning on top.
 */
export function ShopConnections() {
  const {t} = useTranslation();
  const toast = useToast();
  const shops = useLoad(listShops, []);
  const webhooks = useLoad(getWebhookSettings, []);
  const [deleting, setDeleting] = useState<ShopConnection | null>(null);
  const [blocked, setBlocked] = useState<ShopConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const legacy = legacyIssue(webhooks.data, t);

  const test = async (shop: ShopConnection) => {
    try {
      const {ok, text} = testMessage(shop.name, await testShop(shop.id), t);
      if (ok) toast.success(text);
      else toast.error(text);
    } catch (error) {
      toast.error(failureMessage(error, t));
    }
  };

  const setActive = async (shop: ShopConnection, active: boolean) => {
    setBusy(true);
    try {
      await updateShop(shop.id, payloadOf(shop, {active}));
      toast.success(
        t(active ? 'shops.list.activated' : 'shops.list.deactivated', {
          name: shop.name,
        }),
      );
      shops.reload();
    } catch (error) {
      toast.error(failureMessage(error, t));
    } finally {
      setBusy(false);
      setBlocked(null);
    }
  };

  const remove = async (shop: ShopConnection) => {
    setBusy(true);
    try {
      await deleteShop(shop.id);
      toast.success(t('shops.list.deleted', {name: shop.name}));
      shops.reload();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'shop_has_orders') {
        setBlocked(shop);
      } else {
        toast.error(failureMessage(error, t));
      }
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  const add = (
    <Button variant="primary" icon="fa-plus" to="/admin/settings/shops/new">
      {t('shops.list.add')}
    </Button>
  );

  return (
    <div className="kf-shops">
      {legacy && (
        <div className="alert alert-warning kf-shops__legacy" role="alert">
          <i className="fas fa-exclamation-triangle" aria-hidden="true" />{' '}
          {legacy.text}
        </div>
      )}
      {shops.error ? (
        <ErrorState error={shops.error} onRetry={shops.reload} />
      ) : shops.data === undefined ? (
        <Skeleton variant="card" />
      ) : shops.data.length === 0 ? (
        <EmptyState
          icon="fa-store"
          title={t('shops.list.emptyTitle')}
          message={t('shops.list.empty')}
          action={add}
        />
      ) : (
        <>
          <div className="kf-shops__bar">{add}</div>
          <ul className="kf-shops__cards" aria-label={t('shops.list.label')}>
            {shops.data.map((shop) => (
              <li key={shop.id}>
                <ShopCard
                  shop={shop}
                  onTest={() => void test(shop)}
                  onToggle={() => void setActive(shop, !shop.active)}
                  onDelete={() => setDeleting(shop)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {deleting && (
        <ConfirmModal
          title={t('shops.list.deleteTitle', {name: deleting.name})}
          confirmLabel={t('shops.list.deleteConfirm')}
          danger
          busy={busy}
          onConfirm={() => void remove(deleting)}
          onCancel={() => setDeleting(null)}
        >
          {t('shops.list.deleteBody')}
        </ConfirmModal>
      )}
      {blocked && (
        <ConfirmModal
          title={t('shops.list.hasOrdersTitle', {name: blocked.name})}
          confirmLabel={t('shops.list.deactivate')}
          busy={busy}
          onConfirm={() => void setActive(blocked, false)}
          onCancel={() => setBlocked(null)}
        >
          {t('shops.list.hasOrdersBody')}
        </ConfirmModal>
      )}
    </div>
  );
}

import {getDelivery, type ShopDelivery} from '@/entities/shop-connection';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {Button, ErrorState, Skeleton, SlideOver} from '@/shared/ui';
import {failureLabel} from '@/widgets/shop-health';

/** The stored body, indented when it is JSON (as WooCommerce sends it), as stored otherwise. */
function pretty(payload: string): string {
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

/**
 * One delivery of the inbox in a centred panel: what it is (received, reason, attempts) and the body the shop sent
 * (mono, scrolling), with Retry and Discard while it is failed.
 */
export function DeliveryPanel({
  shopId,
  delivery,
  busy,
  onRetry,
  onDiscard,
  onClose,
}: {
  shopId: number;
  delivery: ShopDelivery;
  busy: boolean;
  onRetry: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  const detail = useLoad(
    () => getDelivery(shopId, delivery.id),
    [shopId, delivery.id],
  );
  const failed = delivery.status === 'failed';

  return (
    <SlideOver
      title={
        delivery.remote_order_id
          ? t('shops.deliveries.panelTitle', {id: delivery.remote_order_id})
          : t('shops.deliveries.panelTitleNoId', {id: delivery.id})
      }
      width="lg"
      onClose={onClose}
      footer={
        failed ? (
          <>
            <Button icon="fa-ban" onClick={onDiscard} disabled={busy}>
              {t('shops.deliveries.discard')}
            </Button>
            <Button
              variant="primary"
              icon="fa-redo"
              loading={busy}
              onClick={onRetry}
            >
              {t('shops.deliveries.retry')}
            </Button>
          </>
        ) : undefined
      }
    >
      <dl className="kf-deliveries__facts">
        <div>
          <dt>{t('shops.deliveries.received')}</dt>
          <dd>{dateTime(delivery.received_at)}</dd>
        </div>
        <div>
          <dt>{t('shops.deliveries.status')}</dt>
          <dd>{t(`shops.deliveries.statuses.${delivery.status}`)}</dd>
        </div>
        {delivery.reason_code && (
          <div>
            <dt>{t('shops.deliveries.reason')}</dt>
            <dd>
              {failureLabel(delivery.reason_code, t)}
              {delivery.reason && ` · ${delivery.reason}`}
            </dd>
          </div>
        )}
        <div>
          <dt>{t('shops.deliveries.attempts')}</dt>
          <dd>{delivery.attempts}</dd>
        </div>
      </dl>
      <h3 className="kf-deliveries__body-title">
        {t('shops.deliveries.body')}
      </h3>
      {detail.error ? (
        <ErrorState error={detail.error} onRetry={detail.reload} />
      ) : detail.data === undefined ? (
        <Skeleton variant="text" lines={6} />
      ) : detail.data.payload ? (
        <pre
          className="kf-deliveries__body kf-mono"
          aria-label={t('shops.deliveries.body')}
          tabIndex={0}
        >
          {pretty(detail.data.payload)}
        </pre>
      ) : (
        <p className="kf-deliveries__muted">{t('shops.deliveries.noBody')}</p>
      )}
    </SlideOver>
  );
}

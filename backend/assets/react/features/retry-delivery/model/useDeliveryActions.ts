import {useState} from 'react';
import {
  discardDelivery,
  retryDelivery,
  type ShopDelivery,
} from '@/entities/shop-connection';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useToast} from '@/shared/ui';

/**
 * Retry and Discard of a failed delivery (ROLE_ADMIN): Retry runs the import again from the stored body and says
 * "Order 7502 placed." or why it still is not; Discard sets it aside. `onDone` runs after either answer, so the list
 * reloads (a placed or discarded row leaves the failed filter).
 */
export function useDeliveryActions(
  shopId: number,
  onDone: (delivery: ShopDelivery) => void,
) {
  const {t} = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);

  const fail = (error: unknown) =>
    toast.error(
      error instanceof ApiError && error.code === 'delivery_not_found'
        ? t('shops.errors.delivery_not_found')
        : failureMessage(error, t),
    );

  const retry = async (delivery: ShopDelivery) => {
    setBusy(delivery.id);
    try {
      const answer = await retryDelivery(shopId, delivery.id);
      if (answer.status === 'placed') {
        toast.success(
          t('shops.deliveries.placed', {
            code: answer.order?.code ?? answer.remote_order_id ?? '',
          }),
        );
      } else {
        toast.error(
          t('shops.deliveries.stillFailed', {
            reason: answer.reason ?? t('shops.failures.other'),
          }),
        );
      }
      onDone(answer);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const discard = async (delivery: ShopDelivery) => {
    setBusy(delivery.id);
    try {
      const answer = await discardDelivery(shopId, delivery.id);
      toast.success(t('shops.deliveries.discarded'));
      onDone(answer);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  return {retry, discard, busy};
}

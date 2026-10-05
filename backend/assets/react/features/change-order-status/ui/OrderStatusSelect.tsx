import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ORDER_STATUSES, ORDER_STATUS_SENT, type Order} from '@/entities/order';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {changeOrderStatus} from '../api/changeOrderStatusApi';

/**
 * An order's status in its row, changed in place (ROLE_UPDATE_ORDERS). Sent takes the stock out, so it is not a
 * plain change: choosing it opens the order's getting-ready screen, as the legacy list did.
 */
export function OrderStatusSelect({
  order,
  onResult,
}: {
  order: Pick<Order, 'id' | 'code' | 'status'>;
  onResult: (result: {ok: boolean; message: string}) => void;
}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<number | null>(null);
  const code = order.code ?? String(order.id);

  const change = async (status: number) => {
    if (status === ORDER_STATUS_SENT) {
      navigate(`/admin/orders/${order.id}/getting-ready`);
      return;
    }
    setPending(status);
    try {
      await changeOrderStatus(order.id, status);
      onResult({
        ok: true,
        message: t('orders.statusChanged', {
          code,
          status: t(`orders.statuses.${status}`),
        }),
      });
    } catch (error) {
      onResult({ok: false, message: describe(error, t)});
    } finally {
      setPending(null);
    }
  };

  return (
    <select
      className="form-control form-control-sm"
      aria-label={t('orders.statusOf', {code})}
      value={pending ?? order.status}
      disabled={pending !== null}
      onChange={(event) => void change(Number(event.target.value))}
    >
      {ORDER_STATUSES.map((status) => (
        <option key={status} value={status}>
          {t(`orders.statuses.${status}`)}
        </option>
      ))}
    </select>
  );
}

function describe(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('errors.forbidden');
    if (
      error.code === 'order_not_found' ||
      error.code === 'validation_failed'
    ) {
      return t(`orders.errors.${error.code}`);
    }
  }
  return failureMessage(error, t);
}

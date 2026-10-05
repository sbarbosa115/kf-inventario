import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  ORDER_STATUSES,
  ORDER_STATUS_SENT,
  OrderStatusBadge,
  type Order,
} from '@/entities/order';
import {useCan} from '@/entities/session';
import {ApiError, failureMessage} from '@/shared/api';
import {useTranslation, type Translate} from '@/shared/i18n';
import {ConfirmModal, RowMenu, useToast} from '@/shared/ui';
import {changeOrderStatus} from '../api/changeOrderStatusApi';
import './order-status-menu.css';

/**
 * An order's status badge, which is also the menu that changes it (ROLE_UPDATE_ORDERS; a plain badge for anyone
 * else). Every change is confirmed first; Sent takes the stock out, so choosing it opens the order's getting-ready
 * screen instead, as the legacy list did. `onChanged` runs once the API has taken the new status.
 */
export function OrderStatusMenu({
  order,
  onChanged,
}: {
  order: Pick<Order, 'id' | 'code' | 'status'>;
  onChanged: (status: number) => void;
}) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const canChange = useCan('ROLE_UPDATE_ORDERS');
  const [asking, setAsking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const code = order.code ?? String(order.id);

  if (!canChange) return <OrderStatusBadge status={order.status} />;

  const choose = (status: number) => {
    if (status === order.status) return;
    if (status === ORDER_STATUS_SENT) {
      navigate(`/admin/orders/${order.id}/getting-ready`);
      return;
    }
    setAsking(status);
  };

  const confirm = async (status: number) => {
    setBusy(true);
    try {
      await changeOrderStatus(order.id, status);
      toast.success(
        t('orders.status.changed', {
          code,
          status: t(`orders.statuses.${status}`),
        }),
      );
      onChanged(status);
    } catch (error) {
      toast.error(describe(error, t));
    } finally {
      setBusy(false);
      setAsking(null);
    }
  };

  const name = (status: number) => t(`orders.statuses.${status}`);
  return (
    <>
      <RowMenu
        label={t('orders.status.menu', {code})}
        align="start"
        triggerClassName="kf-status-menu"
        trigger={
          <>
            <OrderStatusBadge status={order.status} />
            <i
              className="fas fa-chevron-down kf-status-menu__chevron"
              aria-hidden="true"
            />
          </>
        }
        actions={ORDER_STATUSES.map((status) => ({
          label: name(status),
          checked: status === order.status,
          onSelect: () => choose(status),
        }))}
      />
      {asking !== null && (
        <ConfirmModal
          title={t('orders.status.confirmTitle', {code, status: name(asking)})}
          confirmLabel={t('orders.status.confirm', {status: name(asking)})}
          busy={busy}
          onConfirm={() => void confirm(asking)}
          onCancel={() => setAsking(null)}
        >
          <p className="mb-0">
            {t('orders.status.confirmBody', {
              from: name(order.status),
              status: name(asking),
            })}
          </p>
        </ConfirmModal>
      )}
    </>
  );
}

function describe(error: unknown, t: Translate): string {
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

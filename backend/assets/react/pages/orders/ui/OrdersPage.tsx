import {useCallback, useState} from 'react';
import type {Order} from '@/entities/order';
import {useCan} from '@/entities/session';
import {CheckNowButton} from '@/features/check-shop-orders';
import {useTranslation} from '@/shared/i18n';
import {Button, PageHeader} from '@/shared/ui';
import {OrderDetail, type OrderDetailSection} from '@/widgets/order-detail';
import {OrderTable} from '@/widgets/order-table';
import {ShopHealth} from '@/widgets/shop-health';

/**
 * Orders (ROLE_CAN_READ_ORDERS): a warehouse's orders, Create order and "Check now" (the shops) by role, the shops'
 * warning line for admins, and one order's detail in a slide-over beside the list. What changes in the detail
 * (status, comments) reloads the list at once; a check reloads the list and the warning line.
 */
export function OrdersPage() {
  const {t} = useTranslation();
  const canCreate = useCan('ROLE_CAN_CREATE_ORDERS');
  const canSync = useCan('ROLE_CAN_SYNC_ORDERS');
  const canSeeShops = useCan('ROLE_ADMIN');
  const [detail, setDetail] = useState<{
    order: Order;
    section: OrderDetailSection;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((n) => n + 1), []);
  const open = useCallback(
    (order: Order, section: OrderDetailSection) => setDetail({order, section}),
    [],
  );
  const close = useCallback(() => setDetail(null), []);

  return (
    <>
      <PageHeader
        title={t('orders.title')}
        primary={
          canCreate && (
            <Button variant="primary" icon="fa-plus" to="/admin/orders/new">
              {t('orders.create')}
            </Button>
          )
        }
        secondary={canSync && <CheckNowButton onChecked={refresh} />}
      />
      {canSeeShops && <ShopHealth refreshKey={refreshKey} />}
      <OrderTable onOpenDetail={open} refreshKey={refreshKey} />
      {detail && (
        <OrderDetail
          key={detail.order.id}
          orderId={detail.order.id}
          code={detail.order.code}
          section={detail.section}
          onClose={close}
          onChanged={refresh}
        />
      )}
    </>
  );
}

import {useCallback, useRef, useState} from 'react';
import {useTranslation} from '@/shared/i18n';
import {PageCard} from '@/shared/ui';
import {OrderDetail, type OrderDetailTab} from '@/widgets/order-detail';
import {OrderTable} from '@/widgets/order-table';

/**
 * View Orders (ROLE_CAN_READ_ORDERS): a warehouse's orders and, over them, the detail of one. Comments saved in the
 * detail show in the list's counts once it closes.
 */
export function OrdersPage() {
  const {t} = useTranslation();
  const [detail, setDetail] = useState<{
    id: number;
    tab: OrderDetailTab;
  } | null>(null);
  // A ref, not state: the dialog's onClose stays the same function (Modal refocuses itself when it changes).
  const commented = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const open = useCallback(
    (id: number, tab: OrderDetailTab) => setDetail({id, tab}),
    [],
  );
  const close = useCallback(() => {
    setDetail(null);
    if (commented.current) {
      commented.current = false;
      setRefreshKey((n) => n + 1);
    }
  }, []);
  const onCommentsChanged = useCallback(() => {
    commented.current = true;
  }, []);

  return (
    <PageCard title={t('orders.title')}>
      <OrderTable onOpenDetail={open} refreshKey={refreshKey} />
      {detail && (
        <OrderDetail
          key={detail.id}
          orderId={detail.id}
          initialTab={detail.tab}
          onClose={close}
          onCommentsChanged={onCommentsChanged}
        />
      )}
    </PageCard>
  );
}

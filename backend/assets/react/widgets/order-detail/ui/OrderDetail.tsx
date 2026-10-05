import {useId, useMemo, useState, type ReactNode} from 'react';
import {
  formatOrderLongDate,
  getOrder,
  orderPdfUrl,
  orderRemainingPdfUrl,
  sourceKey,
  type OrderDetail as Order,
} from '@/entities/order';
import {OrderComments} from '@/features/edit-order-comments';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {DataTable, ErrorState, Loader, Modal, type Column} from '@/shared/ui';

export type OrderDetailTab = 'products' | 'comments';

type Line = Order['products'][number];

/**
 * The Order Detail dialog: who ordered, where it goes, its products and its comments (in tabs), and the order's
 * PDFs. `onCommentsChanged` runs after each comments save, so the list can refresh its counts.
 */
export function OrderDetail({
  orderId,
  initialTab = 'products',
  onClose,
  onCommentsChanged,
}: {
  orderId: number;
  initialTab?: OrderDetailTab;
  onClose: () => void;
  onCommentsChanged?: () => void;
}) {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(() => getOrder(orderId), [orderId]);

  return (
    <Modal
      title={t('orders.detail')}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <a
            href={orderRemainingPdfUrl(orderId)}
            className="btn btn-info"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="fas fa-file-pdf mr-1" aria-hidden="true" />
            {t('orders.remainingPdf')}
          </a>
          <a
            href={orderPdfUrl(orderId)}
            className="btn btn-success"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="fas fa-file-pdf mr-1" aria-hidden="true" />
            {t('orders.downloadPdf')}
          </a>
          <button type="button" className="btn btn-danger" onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      {error instanceof ApiError && error.status === 404 ? (
        <div className="alert alert-warning" role="alert">
          {t('orders.errors.order_not_found')}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Loader />
      ) : (
        <Detail
          order={data}
          initialTab={initialTab}
          onCommentsChanged={onCommentsChanged}
        />
      )}
    </Modal>
  );
}

function Detail({
  order,
  initialTab,
  onCommentsChanged,
}: {
  order: Order;
  initialTab: OrderDetailTab;
  onCommentsChanged?: () => void;
}) {
  const {t} = useTranslation();
  const [tab, setTab] = useState<OrderDetailTab>(initialTab);
  const id = useId();
  const customer = order.customer;
  const address = customer?.addresses[0];
  const city = address?.city;

  const columns = useMemo<Column<Line>[]>(
    () => [
      {
        key: 'code',
        header: t('orders.products.code'),
        render: (line) => line.product.code,
      },
      {
        key: 'title',
        header: t('orders.products.description'),
        render: (line) => line.product.title,
      },
      {
        key: 'quantity',
        header: t('orders.products.quantity'),
        render: (line) => line.quantity,
        numeric: true,
      },
    ],
    [t],
  );

  const tabs: OrderDetailTab[] = ['products', 'comments'];

  return (
    <>
      <div className="row">
        <div className="col-md-12">
          <Info label={t('orders.info.source')}>
            {t(`orders.sources.${sourceKey(order.source)}`)}
          </Info>
          <Info label={t('orders.info.status')}>
            {t(`orders.statuses.${order.status}`)}
          </Info>
        </div>
        <div className="col-md-12">
          <Info label={t('orders.info.customer')}>
            {customer
              ? [customer.first_name, customer.last_name]
                  .filter((part) => part)
                  .join(' ')
              : t('orders.noCustomer')}
          </Info>
          {customer?.email && (
            <Info label={t('orders.info.email')}>{customer.email}</Info>
          )}
        </div>
        <div className="col-md-12">
          <Info label={t('orders.info.code')}>{order.code}</Info>
          <Info label={t('orders.info.createdAt')}>
            {formatOrderLongDate(order.created_at)}
          </Info>
        </div>
        {address && (
          <>
            <div className="col-md-12">
              <Info label={t('orders.info.address')}>{address.address}</Info>
              <Info label={t('orders.info.zipCode')}>{address.zip_code}</Info>
            </div>
            {city && (
              <div className="col-md-12">
                <Info label={t('orders.info.city')}>{city.name}</Info>
                <Info label={t('orders.info.state')}>{city.state.name}</Info>
                <Info label={t('orders.info.country')}>
                  {city.state.country.name}
                </Info>
              </div>
            )}
          </>
        )}
      </div>
      <hr />
      <ul className="nav nav-tabs" role="tablist">
        {tabs.map((name) => (
          <li className="nav-item" key={name}>
            <button
              type="button"
              role="tab"
              id={`${id}-${name}-tab`}
              aria-controls={`${id}-${name}`}
              aria-selected={tab === name}
              className={`nav-link btn btn-link${tab === name ? ' active' : ''}`}
              onClick={() => setTab(name)}
            >
              {t(`orders.tabs.${name}`)}
            </button>
          </li>
        ))}
      </ul>
      <div
        role="tabpanel"
        id={`${id}-${tab}`}
        aria-labelledby={`${id}-${tab}-tab`}
        className="pt-2"
      >
        {tab === 'products' ? (
          <DataTable
            columns={columns}
            rows={order.products}
            rowKey={(line) => line.uuid}
            searchable={false}
            pageSize={5}
            emptyMessage={t('orders.products.empty')}
          />
        ) : (
          <OrderComments
            orderId={order.id}
            comments={order.comments}
            onSaved={() => onCommentsChanged?.()}
          />
        )}
      </div>
    </>
  );
}

function Info({label, children}: {label: string; children: ReactNode}) {
  return (
    <span className="mr-3">
      {label}: <strong>{children}</strong>
    </span>
  );
}

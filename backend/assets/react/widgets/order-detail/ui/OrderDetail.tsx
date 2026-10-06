import {useEffect, useMemo, useRef, type ReactNode, type Ref} from 'react';
import {
  customerName,
  getOrder,
  orderPdfUrl,
  orderRemainingPdfUrl,
  orderXlsUrl,
  OrderSource,
  type OrderDetail as Order,
} from '@/entities/order';
import {useCan} from '@/entities/session';
import {OrderStatusMenu} from '@/features/change-order-status';
import {OrderComments} from '@/features/edit-order-comments';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useFormat, useLoad} from '@/shared/lib';
import {
  Button,
  DataTable,
  ErrorState,
  Num,
  RowMenu,
  Skeleton,
  SlideOver,
  type Column,
} from '@/shared/ui';
import './order-detail.css';

export type OrderDetailSection = 'products' | 'comments';

type Line = Order['products'][number];

/**
 * An order in a slide-over beside its list: the code, status, source, warehouse and date on top with what can be done
 * to it (status, edit, getting ready, documents), then its customer, products and comments as sections. `onChanged`
 * runs after the status or the comments change, so the list can reload.
 */
export function OrderDetail({
  orderId,
  code,
  section = 'products',
  onClose,
  onChanged,
}: {
  orderId: number;
  /** The order number, known from the list, so the title is right before the order loads. */
  code?: string | null;
  /** Comments scrolls the comments into view. */
  section?: OrderDetailSection;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(() => getOrder(orderId), [orderId]);
  const title = t('orders.detail.title', {
    code: data?.code ?? code ?? String(orderId),
  });

  return (
    <SlideOver
      title={title}
      width="lg"
      onClose={onClose}
      header={
        data && (
          <OrderHeader
            order={data}
            onStatusChanged={() => {
              reload();
              onChanged?.();
            }}
          />
        )
      }
    >
      {error instanceof ApiError && error.status === 404 ? (
        <div className="alert alert-warning" role="alert">
          {t('orders.errors.order_not_found')}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Skeleton variant="text" lines={6} />
      ) : (
        <Sections
          order={data}
          section={section}
          onCommentsSaved={() => onChanged?.()}
        />
      )}
    </SlideOver>
  );
}

function OrderHeader({
  order,
  onStatusChanged,
}: {
  order: Order;
  onStatusChanged: () => void;
}) {
  const {t} = useTranslation();
  const {dateTime} = useFormat();
  const canEdit = useCan('ROLE_CAN_UPDATE_ORDERS');

  return (
    <div className="kf-order-detail__header">
      <dl
        className="kf-order-detail__facts"
        aria-label={t('orders.detail.facts')}
      >
        <Fact label={t('orders.columns.status')}>
          <OrderStatusMenu order={order} onChanged={onStatusChanged} />
        </Fact>
        <Fact label={t('orders.detail.source')}>
          <OrderSource source={order.source} />
        </Fact>
        {order.warehouse && (
          <Fact label={t('orders.detail.warehouse')}>
            {order.warehouse.name}
          </Fact>
        )}
        <Fact label={t('orders.detail.created')}>
          {dateTime(order.created_at)}
        </Fact>
      </dl>
      <div className="kf-order-detail__actions">
        {canEdit && (
          <Button size="sm" icon="fa-pen" to={`/admin/orders/${order.id}/edit`}>
            {t('orders.actions.edit')}
          </Button>
        )}
        <Button
          size="sm"
          icon="fa-truck-loading"
          to={`/admin/orders/${order.id}/getting-ready`}
        >
          {t('orders.actions.gettingReady')}
        </Button>
        <RowMenu
          label={t('orders.actions.documents')}
          align="start"
          triggerClassName="kf-btn kf-btn--secondary kf-btn--sm"
          trigger={
            <>
              <i className="fas fa-file-alt kf-btn__icon" aria-hidden="true" />
              <span className="kf-btn__label">
                {t('orders.actions.documents')}
              </span>
              <i className="fas fa-chevron-down" aria-hidden="true" />
            </>
          }
          actions={[
            {
              label: t('orders.actions.pdf'),
              icon: 'fa-file-pdf',
              href: orderPdfUrl(order.id),
              external: true,
            },
            {
              label: t('orders.actions.remainingPdf'),
              icon: 'fa-file-pdf',
              href: orderRemainingPdfUrl(order.id),
              external: true,
            },
            {
              label: t('orders.actions.xls'),
              icon: 'fa-file-excel',
              href: orderXlsUrl(order.id),
              external: true,
            },
          ]}
        />
      </div>
    </div>
  );
}

function Sections({
  order,
  section,
  onCommentsSaved,
}: {
  order: Order;
  section: OrderDetailSection;
  onCommentsSaved: () => void;
}) {
  const {t} = useTranslation();
  const comments = useRef<HTMLElement>(null);

  useEffect(() => {
    if (section === 'comments') comments.current?.scrollIntoView?.();
  }, [section]);

  const columns = useMemo<Column<Line>[]>(
    () => [
      {
        key: 'code',
        header: t('orders.products.code'),
        render: (line) => line.product.code,
        mono: true,
      },
      {
        key: 'title',
        header: t('orders.products.title'),
        render: (line) => line.product.title,
      },
      {
        key: 'quantity',
        header: t('orders.products.quantity'),
        render: (line) => <Num value={line.quantity} />,
        numeric: true,
      },
    ],
    [t],
  );

  return (
    <>
      <Section title={t('orders.detail.customer')}>
        <Customer order={order} />
      </Section>
      <Section title={t('orders.detail.products')}>
        <DataTable
          columns={columns}
          rows={order.products}
          rowKey={(line) => line.uuid}
          rowLabel={(line) => line.product.code}
          searchable={false}
          pageSize={0}
          emptyMessage={t('orders.products.empty')}
        />
      </Section>
      <Section title={t('orders.detail.comments')} sectionRef={comments}>
        <OrderComments
          orderId={order.id}
          comments={order.comments}
          onSaved={onCommentsSaved}
        />
      </Section>
    </>
  );
}

function Customer({order}: {order: Order}) {
  const {t} = useTranslation();
  const customer = order.customer;
  if (!customer) {
    return <p className="kf-order-detail__muted">{t('orders.noCustomer')}</p>;
  }
  const address = customer.addresses[0];
  const city = address?.city;
  const where = address
    ? [
        address.address,
        address.zip_code,
        city?.name,
        city?.state.name,
        city?.state.country.name,
      ]
        .filter(Boolean)
        .join(', ')
    : null;
  return (
    <>
      <p className="kf-order-detail__name">{customerName(customer)}</p>
      <dl className="kf-order-detail__facts">
        {customer.email && (
          <Fact label={t('orders.detail.email')}>{customer.email}</Fact>
        )}
        {customer.phone && (
          <Fact label={t('orders.detail.phone')}>{customer.phone}</Fact>
        )}
        <Fact label={t('orders.detail.address')}>
          {where ?? (
            <span className="kf-order-detail__muted">
              {t('orders.detail.noAddress')}
            </span>
          )}
        </Fact>
      </dl>
    </>
  );
}

function Section({
  title,
  sectionRef,
  children,
}: {
  title: string;
  sectionRef?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section className="kf-order-detail__section" ref={sectionRef}>
      <h3 className="kf-order-detail__section-title">{title}</h3>
      {children}
    </section>
  );
}

function Fact({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="kf-order-detail__fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

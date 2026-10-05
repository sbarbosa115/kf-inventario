import {Link, useParams} from 'react-router-dom';
import {listAllCustomers} from '@/entities/customer';
import {listLocations} from '@/entities/location';
import {listWarehouses} from '@/entities/warehouse';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, Loader, PageCard} from '@/shared/ui';
import {getOrder} from '../api/orderFormApi';
import {OrderForm} from './OrderForm';

/** Create a new order (/admin/orders/new) and Editing Order (/admin/orders/:id/edit): one form for both. */
export function OrderFormPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return (
    <PageCard
      title={
        id === undefined ? t('orderForm.newTitle') : t('orderForm.editTitle')
      }
    >
      <Loaded id={id} />
    </PageCard>
  );
}

/**
 * The warehouses, the locations tree, the customers for the picker and, on an edit, the order. The customers are
 * optional: if they cannot be loaded the customer is typed (the order roles read them, as the legacy form embedded
 * them).
 */
function Loaded({id}: {id: string | undefined}) {
  const {t} = useTranslation();
  const warehouses = useLoad(listWarehouses, []);
  const locations = useLoad(listLocations, []);
  const customers = useLoad(listAllCustomers, []);
  const order = useLoad(
    () => (id === undefined ? Promise.resolve(undefined) : getOrder(id)),
    [id],
  );
  const error = order.error ?? warehouses.error ?? locations.error;

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="alert alert-warning" role="alert">
        <p>{t('orderForm.notFound')}</p>
        <Link to="/admin/orders">{t('orderForm.backToList')}</Link>
      </div>
    );
  }
  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="alert alert-danger" role="alert">
        {t('errors.forbidden')}
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          order.reload();
          warehouses.reload();
          locations.reload();
        }}
      />
    );
  }
  const customersSettled = customers.data !== undefined || !!customers.error;
  if (
    warehouses.data === undefined ||
    locations.data === undefined ||
    !customersSettled ||
    (id !== undefined && order.data === undefined)
  ) {
    return <Loader />;
  }
  return (
    <OrderForm
      order={order.data}
      warehouses={warehouses.data}
      locations={locations.data}
      customers={customers.data ?? []}
      customersUnavailable={!!customers.error}
    />
  );
}

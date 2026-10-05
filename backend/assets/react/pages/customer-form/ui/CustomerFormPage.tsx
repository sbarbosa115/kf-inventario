import {Link, useParams} from 'react-router-dom';
import {getCustomer} from '@/entities/customer';
import {listLocations} from '@/entities/location';
import {ApiError} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, Loader, PageCard} from '@/shared/ui';
import {CustomerForm} from './CustomerForm';

/** New Customer (/admin/customers/new) and Edit Customer (/admin/customers/:id/edit): one form for both. */
export function CustomerFormPage() {
  const {t} = useTranslation();
  const {id} = useParams();
  return (
    <PageCard
      title={
        id === undefined
          ? t('customers.form.newTitle')
          : t('customers.form.editTitle')
      }
    >
      <Loaded id={id} />
    </PageCard>
  );
}

/** The locations tree (and, on an edit, the customer) first: the selects need both to show what is saved. */
function Loaded({id}: {id: string | undefined}) {
  const {t} = useTranslation();
  const locations = useLoad(listLocations, []);
  const customer = useLoad(
    () => (id === undefined ? Promise.resolve(undefined) : getCustomer(id)),
    [id],
  );
  const missing =
    customer.error instanceof ApiError && customer.error.status === 404;
  const error = customer.error ?? locations.error;

  if (missing) {
    return (
      <div className="alert alert-warning" role="alert">
        <p>{t('customers.notFound')}</p>
        <Link to="/admin/customers">{t('customers.backToList')}</Link>
      </div>
    );
  }
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          customer.reload();
          locations.reload();
        }}
      />
    );
  }
  if (
    locations.data === undefined ||
    (id !== undefined && customer.data === undefined)
  ) {
    return <Loader />;
  }
  return <CustomerForm customer={customer.data} locations={locations.data} />;
}

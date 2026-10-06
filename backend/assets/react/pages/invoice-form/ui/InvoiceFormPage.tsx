import {listAllCustomers} from '@/entities/customer';
import {nextInvoiceCode} from '@/entities/invoice';
import {listLocations} from '@/entities/location';
import {listWarehouses} from '@/entities/warehouse';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, PageHeader, Skeleton} from '@/shared/ui';
import {InvoiceForm} from './InvoiceForm';

/** Create invoice (/admin/invoices/new): the code, customers, places and warehouses first, then the form. */
export function InvoiceFormPage() {
  const {t} = useTranslation();
  return (
    <>
      <PageHeader title={t('invoices.create')} back="/admin/invoices" />
      <Loaded />
    </>
  );
}

function Loaded() {
  const code = useLoad(nextInvoiceCode, []);
  const customers = useLoad(listAllCustomers, []);
  const locations = useLoad(listLocations, []);
  const warehouses = useLoad(listWarehouses, []);
  const error =
    code.error ?? customers.error ?? locations.error ?? warehouses.error;

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          code.reload();
          customers.reload();
          locations.reload();
          warehouses.reload();
        }}
      />
    );
  }
  if (
    code.data === undefined ||
    customers.data === undefined ||
    locations.data === undefined ||
    warehouses.data === undefined
  ) {
    return <Skeleton variant="form" />;
  }
  return (
    <InvoiceForm
      suggestedCode={code.data.code}
      customers={customers.data}
      locations={locations.data}
      warehouses={warehouses.data}
    />
  );
}

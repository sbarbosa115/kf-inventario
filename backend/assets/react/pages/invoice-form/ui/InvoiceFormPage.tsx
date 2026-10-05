import {listLocations} from '@/entities/location';
import {listCustomerChoices, nextInvoiceCode} from '@/entities/invoice';
import {listWarehouses} from '@/entities/warehouse';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, Loader, PageCard} from '@/shared/ui';
import {InvoiceForm} from './InvoiceForm';

/** Create invoice (/admin/invoices/new): the code, customers, places and warehouses first, then the form. */
export function InvoiceFormPage() {
  const {t} = useTranslation();
  return (
    <PageCard title={t('invoices.create')}>
      <Loaded />
    </PageCard>
  );
}

function Loaded() {
  const code = useLoad(nextInvoiceCode, []);
  const customers = useLoad(listCustomerChoices, []);
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
    return <Loader />;
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

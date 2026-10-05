import {ScanStock} from '@/features/scan-stock';
import {apiGet, type Schema} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {EmptyState, ErrorState, Loader, PageCard} from '@/shared/ui';

/** Update by bar code: read codes, then add them to or remove them from a warehouse (ROLE_MANAGE_INVENTORY). */
export function BarcodeReaderPage() {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(
    () => apiGet<Schema<'WarehouseOutput'>[]>('/warehouses'),
    [],
  );

  return (
    <PageCard title={t('stock.barcode.title')}>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Loader />
      ) : data.length === 0 ? (
        <EmptyState message={t('stock.warehouse.none')} />
      ) : (
        <ScanStock warehouses={data} />
      )}
    </PageCard>
  );
}

import {UploadProductsForm} from '@/features/upload-products';
import {apiGet, type Schema} from '@/shared/api';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {ErrorState, Loader, PageCard} from '@/shared/ui';

/** Upload products: a spreadsheet of products and quantities for one warehouse (ROLE_MANAGE_INVENTORY). */
export function ProductsUploadPage() {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(
    () => apiGet<Schema<'WarehouseOutput'>[]>('/warehouses'),
    [],
  );

  return (
    <PageCard title={t('stock.upload.title')}>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Loader />
      ) : (
        <UploadProductsForm warehouses={data} />
      )}
    </PageCard>
  );
}

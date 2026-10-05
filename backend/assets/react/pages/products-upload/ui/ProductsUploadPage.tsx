import {listWarehouses} from '@/entities/warehouse';
import {UploadProductsForm} from '@/features/upload-products';
import {useTranslation} from '@/shared/i18n';
import {useLoad} from '@/shared/lib';
import {EmptyState, ErrorState, PageHeader, Skeleton} from '@/shared/ui';

/** Upload a stock sheet: products and quantities for one warehouse, from the template (ROLE_MANAGE_INVENTORY). */
export function ProductsUploadPage() {
  const {t} = useTranslation();
  const {data, error, reload} = useLoad(listWarehouses, []);

  return (
    <>
      <PageHeader title={t('stock.upload.title')} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data === undefined ? (
        <Skeleton variant="form" />
      ) : data.length === 0 ? (
        <EmptyState icon="fa-warehouse" message={t('stock.warehouse.none')} />
      ) : (
        <UploadProductsForm warehouses={data} />
      )}
    </>
  );
}

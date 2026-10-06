import {useTranslation} from '@/shared/i18n';
import {Button, PageHeader} from '@/shared/ui';
import {StockTable} from '@/widgets/stock-table';

/** Products (ROLE_MANAGE_INVENTORY): a warehouse's stock, moves between warehouses, the stock sheet. */
export function ProductsPage() {
  const {t} = useTranslation();
  return (
    <>
      <PageHeader
        title={t('products.title')}
        primary={
          <Button variant="primary" icon="fa-plus" to="/admin/products/new">
            {t('products.create')}
          </Button>
        }
      />
      <StockTable />
    </>
  );
}

import {useLocation} from 'react-router-dom';
import {useTranslation} from '@/shared/i18n';
import {PageCard} from '@/shared/ui';
import {StockTable} from '@/widgets/stock-table';

/** View products (ROLE_MANAGE_INVENTORY): a warehouse's stock, moves between warehouses, the stock spreadsheet. */
export function ProductsPage() {
  const {t} = useTranslation();
  const saved = (useLocation().state as {saved?: 'created' | 'updated'} | null)
    ?.saved;

  return (
    <PageCard title={t('products.title')}>
      {saved && (
        <div className="alert alert-success" role="status">
          {t(`products.${saved}`)}
        </div>
      )}
      <StockTable />
    </PageCard>
  );
}

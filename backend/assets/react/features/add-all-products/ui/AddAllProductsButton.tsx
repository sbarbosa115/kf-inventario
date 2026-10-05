import type {LineValues} from '@/entities/invoice';
import type {StockItem} from '@/entities/product';
import {useTranslation} from '@/shared/i18n';
import {addAllProducts} from '../model/addAll';

/** "Add all products": puts every product of the warehouse's stock on the invoice that is not on it yet. */
export function AddAllProductsButton({
  stock,
  lines,
  onChange,
}: {
  stock: StockItem[] | undefined;
  lines: LineValues[];
  onChange: (lines: LineValues[]) => void;
}) {
  const {t} = useTranslation();
  return (
    <button
      type="button"
      className="btn btn-sm btn-secondary mr-2"
      disabled={stock === undefined || stock.length === 0}
      onClick={() => stock && onChange(addAllProducts(stock, lines))}
    >
      {t('invoices.form.addAll')}
    </button>
  );
}

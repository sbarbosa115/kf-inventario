import type {LineValues} from '@/entities/invoice';
import type {StockItem} from '@/entities/product';
import {useTranslation} from '@/shared/i18n';
import {Button} from '@/shared/ui';
import {addAllProducts} from '../model/addAll';

/**
 * "Add all products from <warehouse>": puts every product of the warehouse's stock on the invoice that is not on it
 * yet.
 */
export function AddAllProductsButton({
  stock,
  warehouseName,
  lines,
  onChange,
}: {
  stock: StockItem[] | undefined;
  warehouseName: string;
  lines: LineValues[];
  onChange: (lines: LineValues[]) => void;
}) {
  const {t} = useTranslation();
  return (
    <Button
      variant="secondary"
      icon="fa-layer-group"
      disabled={stock === undefined || stock.length === 0}
      onClick={() => stock && onChange(addAllProducts(stock, lines))}
    >
      {t('invoices.form.addAll', {warehouse: warehouseName})}
    </Button>
  );
}

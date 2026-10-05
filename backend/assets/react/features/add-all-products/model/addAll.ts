import {emptyLine, lineIsFilled, type LineValues} from '@/entities/invoice';
import type {StockItem} from '@/entities/product';

/**
 * The lines for every product of the warehouse that is not on the invoice yet: quantity 1, the product's title and
 * price. The legacy button did the same; an empty first row is replaced rather than left in the way.
 */
export function addAllProducts(
  stock: StockItem[],
  lines: LineValues[],
): LineValues[] {
  const kept = lines.filter(lineIsFilled);
  const present = new Set(kept.map((line) => line.product_id));
  const added = stock
    .filter((item) => !present.has(item.product_id))
    .map((item) => ({
      ...emptyLine(),
      product_id: item.product_id,
      description: item.title,
      unit_price: String(item.price ?? 0),
    }));
  return [...kept, ...added];
}

import type {StockItem} from '../api/productApi';

/** The quick filter on a stock list: rows holding units, or rows at zero. */
export type StockFilter = 'in' | 'out';

export interface StockFigures {
  products: number;
  units: number;
  /** Σ quantity × price (a missing price counts as 0). */
  value: number;
  inStock: number;
  outOfStock: number;
}

/** What the stock header shows, computed from the rows the screen already loaded. */
export function stockFigures(rows: readonly StockItem[]): StockFigures {
  let units = 0;
  let value = 0;
  let inStock = 0;
  for (const row of rows) {
    units += row.quantity;
    value += row.quantity * (row.price ?? 0);
    if (row.quantity > 0) inStock += 1;
  }
  return {
    products: rows.length,
    units,
    value,
    inStock,
    outOfStock: rows.length - inStock,
  };
}

/** Whether a row passes the chip (null: All). */
export function matchesStock(
  row: StockItem,
  filter: StockFilter | null,
): boolean {
  if (filter === null) return true;
  return filter === 'in' ? row.quantity > 0 : row.quantity <= 0;
}

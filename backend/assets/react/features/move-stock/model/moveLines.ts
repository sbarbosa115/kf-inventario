import type {StockItem} from '@/entities/product';
import type {MoveItem} from '../api/moveStockApi';

/** The quantities a row offers: 1 up to what the warehouse holds (none when it holds nothing). */
export function quantityOptions(available: number): number[] {
  return Array.from({length: Math.max(0, available)}, (_, index) => index + 1);
}

/**
 * What is sent: every row with stock, with the quantity picked for it, or 1 when none was picked (the select shows 1).
 * The legacy modal sent only the rows whose select had been changed, so a row left at 1 silently did not move.
 */
export function moveItems(
  rows: StockItem[],
  picked: Readonly<Record<string, number>>,
): MoveItem[] {
  return rows
    .filter((row) => row.quantity > 0)
    .map((row) => ({
      uuid: row.uuid,
      quantity: Math.min(picked[row.uuid] ?? 1, row.quantity),
    }));
}

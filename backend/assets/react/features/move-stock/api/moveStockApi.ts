import {apiPost} from '@/shared/api';

/** A product (by uuid) and how many of it leave the source warehouse. */
export interface MoveItem {
  uuid: string;
  quantity: number;
}

/** Moves the quantities to another warehouse, where they arrive as incoming stock (204). */
export function moveStock(
  from: number,
  to: number,
  items: MoveItem[],
): Promise<null> {
  return apiPost<null>(`/warehouses/${from}/moves/${to}`, {items});
}

import {apiGet, apiPost, type Schema} from '@/shared/api';

/** One line of the request body (the schema has none): a code and how many. */
export interface StockItem {
  code: string;
  quantity: number;
}

/** Resolves when the product exists; the API answers 404 product_not_found otherwise. */
export async function productExists(code: string): Promise<boolean> {
  try {
    await apiGet<Schema<'ProductOutput'>>(
      `/products/by-code/${encodeURIComponent(code)}`,
    );
    return true;
  } catch {
    return false;
  }
}

export function addStock(warehouseId: number, items: StockItem[]) {
  return apiPost<null>(`/warehouses/${warehouseId}/stock/add`, {items});
}

export function removeStock(warehouseId: number, items: StockItem[]) {
  return apiPost<null>(`/warehouses/${warehouseId}/stock/remove`, {items});
}

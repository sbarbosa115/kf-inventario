import {ApiError, apiGet, apiPost, type Schema} from '@/shared/api';

/** One line of the request body (the schema has none): a code and how many. */
export interface StockItem {
  code: string;
  quantity: number;
}

/** The product with this code, or null when there is none (the API answers 404 product_not_found). */
export async function findProductByCode(
  code: string,
): Promise<Schema<'ProductOutput'> | null> {
  try {
    return await apiGet<Schema<'ProductOutput'>>(
      `/products/by-code/${encodeURIComponent(code)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function addStock(warehouseId: number, items: StockItem[]) {
  return apiPost<null>(`/warehouses/${warehouseId}/stock/add`, {items});
}

export function removeStock(warehouseId: number, items: StockItem[]) {
  return apiPost<null>(`/warehouses/${warehouseId}/stock/remove`, {items});
}

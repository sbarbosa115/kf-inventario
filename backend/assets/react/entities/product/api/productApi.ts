import {apiGet, apiPost, apiPut, type Schema} from '@/shared/api';

export type Product = Schema<'ProductOutput'>;

/** One product's stock in one warehouse, as the stock lists show it. */
export type StockItem = Schema<'StockOutput'>;

/** Stock rows in stock (1) or incoming, waiting for approval (0). */
export const STOCK_IN = 1;
export const STOCK_INCOMING = 0;

/** What the product form sends (the request bodies are not in the OpenAPI schema). */
export interface ProductPayload {
  code: string;
  title: string;
  detail: string | null;
  /** 1: active; 0: inactive */
  status: number;
  price: number | null;
}

export function getProduct(uuid: string): Promise<Product> {
  return apiGet<Product>(`/products/${encodeURIComponent(uuid)}`);
}

export function createProduct(payload: ProductPayload): Promise<Product> {
  return apiPost<Product>('/products', payload);
}

export function updateProduct(
  uuid: string,
  payload: ProductPayload,
): Promise<Product> {
  return apiPut<Product>(`/products/${encodeURIComponent(uuid)}`, payload);
}

/** A warehouse's stock rows with that status (in stock by default), by product. */
export function listStock(
  warehouseId: number,
  status: number = STOCK_IN,
): Promise<StockItem[]> {
  return apiGet<StockItem[]>(
    `/warehouses/${warehouseId}/stock?status=${status}`,
  );
}

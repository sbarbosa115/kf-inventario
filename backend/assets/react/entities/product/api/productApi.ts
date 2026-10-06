import {
  apiGet,
  apiPost,
  apiPut,
  listQueryString,
  type ListQuery,
  type Page,
  type Schema,
} from '@/shared/api';

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

/** The figures of every row a stock query keeps (not only the page): units and value. */
export type StockTotals = Schema<'StockTotalsOutput'>;

/** A page of a warehouse's stock, with the totals of every row the filters keep. */
export type StockPage = Page<StockItem> & {totals: StockTotals};

/**
 * A page of a warehouse's stock rows with that status (in stock by default): the list contract (q, filters code,
 * title, detail, quantity, price, in_stock; sorts code, title, quantity, price).
 */
export function listStock(
  warehouseId: number,
  query: ListQuery = {},
  status: number = STOCK_IN,
): Promise<StockPage> {
  const params = new URLSearchParams(listQueryString(query));
  params.set('status', String(status));
  return apiGet<StockPage>(`/warehouses/${warehouseId}/stock?${params}`);
}

/** Every stock row with that status, by code: for the pickers (order form, invoice form, getting ready, incoming). */
export async function listAllStock(
  warehouseId: number,
  status: number = STOCK_IN,
): Promise<StockItem[]> {
  return (await listStock(warehouseId, {perPage: 0}, status)).items;
}

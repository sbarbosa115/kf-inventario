import type {AddressPayload, Customer} from '@/entities/customer';
import {apiGet, apiPost, apiPut, type Schema} from '@/shared/api';

/** An order with its customer, comments and products, as the form edits it. */
export type OrderDetail = Schema<'OrderDetailOutput'>;

/** What the order form sends (the request bodies are not in the OpenAPI schema). */
export interface OrderPayload {
  code: string | null;
  status: number;
  source: number;
  payment_method: number;
  comment: string | null;
  warehouse_id: number;
  /** With an id, that customer (updated with these fields); without, found by email, then phone, or created. */
  customer: {
    id: number | null;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    addresses: AddressPayload[];
  };
  products: {uuid: string; quantity: number}[];
  comments: {content: string}[];
}

export function getOrder(id: number | string): Promise<OrderDetail> {
  return apiGet<OrderDetail>(`/orders/${id}`);
}

/** Places the order; the printer gets its email. */
export function createOrder(payload: OrderPayload): Promise<OrderDetail> {
  return apiPost<OrderDetail>('/orders', payload);
}

/** Edits the order: its products replace the saved ones; its comments are not touched. */
export function updateOrder(
  id: number,
  payload: OrderPayload,
): Promise<OrderDetail> {
  return apiPut<OrderDetail>(`/orders/${id}`, payload);
}

/** Every customer, for the "Search Customer" picker (needs ROLE_MANAGE_CUSTOMERS). */
export function listAllCustomers(): Promise<Customer[]> {
  return apiGet<Customer[]>('/customers/all');
}

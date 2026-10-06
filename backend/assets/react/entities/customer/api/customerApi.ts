import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  listQueryString,
  type ListQuery,
  type Page,
  type Schema,
} from '@/shared/api';

export type Customer = Schema<'CustomerOutput'>;

export type CustomerPage = Page<Customer>;

/** A place of an address: an existing one (its id) or a name to create (id null). */
export interface PlacePayload {
  id: number | null;
  name: string | null;
}

/** What the form sends (the request bodies are not in the OpenAPI schema). */
export interface AddressPayload {
  id: number | null;
  address: string;
  zip_code: string;
  address_type: number | null;
  city: PlacePayload & {
    state: PlacePayload & {country: PlacePayload};
  };
}

export interface CustomerPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  addresses: AddressPayload[];
}

/** The customers' list is paged on the server: 100 a page, as the legacy list. */
export const PAGE_SIZE = 100;

/**
 * A page of customers, newest first: the list contract (q, filters name, email, phone, city, country[]; sorts name,
 * email, city).
 */
export function listCustomers(query: ListQuery = {}): Promise<CustomerPage> {
  return apiGet<CustomerPage>(`/customers${listQueryString(query)}`);
}

/**
 * Every customer (those without an address too), for the order and invoice pickers: readable by the customers
 * screen's role and by the order (create, update) and new-invoice roles, whose legacy forms embedded the list.
 */
export function listAllCustomers(): Promise<Customer[]> {
  return apiGet<Customer[]>('/customers/all');
}

export function getCustomer(id: number | string): Promise<Customer> {
  return apiGet<Customer>(`/customers/${id}`);
}

export function createCustomer(payload: CustomerPayload): Promise<Customer> {
  return apiPost<Customer>('/customers', payload);
}

export function updateCustomer(
  id: number | string,
  payload: CustomerPayload,
): Promise<Customer> {
  return apiPut<Customer>(`/customers/${id}`, payload);
}

export function deleteCustomer(id: number): Promise<null> {
  return apiDelete(`/customers/${id}`);
}

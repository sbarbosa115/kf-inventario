import {apiGet, apiPost, type Schema} from '@/shared/api';

export type Invoice = Schema<'InvoiceOutput'>;
export type InvoiceItem = Schema<'InvoiceItemOutput'>;

/** A customer as the invoice form's picker lists them (the pickers' `GET /customers/all`). */
export type CustomerChoice = Schema<'CustomerOutput'>;

/** One line of what the form sends (the request bodies are not in the OpenAPI schema). Amounts are decimal strings. */
export interface InvoiceLinePayload {
  product_id: number | null;
  description: string;
  quantity: number;
  unit_price: string;
  discount: string;
}

/** The customer typed on the invoice: an existing one (id) or found by email/phone or created, with its addresses. */
export interface InvoiceCustomerPayload {
  id: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  addresses: {
    id: number | null;
    address: string;
    zip_code: string;
    address_type: number | null;
    city: {
      id: number | null;
      name: string | null;
      state: {
        id: number | null;
        name: string | null;
        country: {id: number | null; name: string | null};
      };
    };
  }[];
}

export interface InvoicePayload {
  code: string;
  payment_method: string | null;
  customer: InvoiceCustomerPayload | null;
  customer_address: string | null;
  /** A decimal string: "0" or "6". */
  tax_rate: string;
  comment: string | null;
  items: InvoiceLinePayload[];
}

export function listInvoices(): Promise<Invoice[]> {
  return apiGet<Invoice[]>('/invoices');
}

export function getInvoice(id: number): Promise<Invoice> {
  return apiGet<Invoice>(`/invoices/${id}`);
}

/** The code the next invoice is offered (the newest one's plus one). */
export function nextInvoiceCode(): Promise<Schema<'NextInvoiceCodeOutput'>> {
  return apiGet('/invoices/next-code');
}

export function createInvoice(payload: InvoicePayload): Promise<Invoice> {
  return apiPost<Invoice>('/invoices', payload);
}

export function listCustomerChoices(): Promise<CustomerChoice[]> {
  return apiGet<CustomerChoice[]>('/customers/all');
}

/** The invoice's PDF: a page of its own, opened in a new tab (the session cookie signs the request). */
export function invoicePdfUrl(id: number): string {
  return `/api/v1/invoices/${id}/pdf`;
}

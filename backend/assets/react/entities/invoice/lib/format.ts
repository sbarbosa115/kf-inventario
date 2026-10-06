import type {Invoice} from '../api/invoiceApi';

/** The day (YYYY-MM-DD) the server wrote an ISO 8601 date on, whatever the browser's time zone; '' when it is none. */
export function invoiceDay(iso: string | null | undefined): string {
  return /^\d{4}-\d{2}-\d{2}/.exec(iso ?? '')?.[0] ?? '';
}

/** "First Last"; null when the invoice has no customer (a point-of-sale invoice) or the customer has no name. */
export function customerName(customer: Invoice['customer']): string | null {
  if (!customer) return null;
  const name =
    `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim();
  return name === '' ? null : name;
}

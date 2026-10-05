import type {Invoice} from '../api/invoiceApi';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "05 Oct 2026" from an ISO 8601 date: the day the server wrote, whatever the browser's time zone. */
export function formatInvoiceDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return '';
  return `${match[3]} ${MONTHS[Number(match[2]) - 1] ?? ''} ${match[1]}`;
}

/** "First Last [email]", as the legacy list showed it; null when the invoice has no customer. */
export function customerLabel(customer: Invoice['customer']): string | null {
  if (!customer) return null;
  return `${customer.first_name ?? ''} ${customer.last_name ?? ''} [${customer.email ?? ''}]`;
}

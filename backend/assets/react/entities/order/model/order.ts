import type {Schema} from '@/shared/api';

/** 1 created, 2 processed, 3 completed, 4 partial, 5 sent, 6 delivered (the API's choices, in the legacy order). */
export const ORDER_STATUSES = [1, 2, 3, 4, 5, 6] as const;

/** Sending an order takes its stock out: it goes through the getting-ready screen, never a plain status change. */
export const ORDER_STATUS_SENT = 5;

type CustomerRef = Pick<
  Schema<'CustomerRefOutput'>,
  'first_name' | 'last_name' | 'email'
> & {id: number};

/** "First Last [email]" as the legacy list showed it; null for an order without a customer. */
export function customerLabel(
  customer: CustomerRef | null | undefined,
): string | null {
  if (!customer) return null;
  const name = [customer.first_name, customer.last_name]
    .filter((part) => part)
    .join(' ');
  return customer.email ? `${name} [${customer.email}]`.trim() : name;
}

/** The i18n key under orders.sources of a source (1 web, 2 phone). */
export function sourceKey(source: number): 'web' | 'phone' | 'unknown' {
  if (source === 1) return 'web';
  if (source === 2) return 'phone';
  return 'unknown';
}

// The server writes order dates in Bogota time (CLAUDE.md): show them in it, wherever the browser is.
const SHORT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});
const LONG = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

/** "05 Oct 2026": the list's date column. */
export function formatOrderDate(iso: string | null | undefined): string {
  return iso ? SHORT.format(new Date(iso)) : '';
}

/** "October 5, 2026": the detail's creation date. */
export function formatOrderLongDate(iso: string | null | undefined): string {
  return iso ? LONG.format(new Date(iso)) : '';
}

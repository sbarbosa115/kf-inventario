import type {Schema} from '@/shared/api';
import {TIME_ZONE} from '@/shared/lib';
import type {Tone} from '@/shared/ui';

/** 1 created, 2 processed, 3 completed, 4 partial, 5 sent, 6 delivered (the API's choices, in the legacy order). */
export const ORDER_STATUSES = [1, 2, 3, 4, 5, 6] as const;

/** Sending an order takes its stock out: it goes through the getting-ready screen, never a plain status change. */
export const ORDER_STATUS_SENT = 5;

const TONES: Record<number, {tone: Tone; filled: boolean}> = {
  1: {tone: 'neutral', filled: false},
  2: {tone: 'info', filled: false},
  3: {tone: 'accent', filled: false},
  4: {tone: 'warning', filled: false},
  5: {tone: 'info', filled: false},
  6: {tone: 'accent', filled: true},
};

/** The badge of a status (docs/pdr/prd-redesign.md, "Status colours"); always shown with its word. */
export function statusTone(status: number): {tone: Tone; filled: boolean} {
  return TONES[status] ?? {tone: 'neutral', filled: false};
}

type CustomerRef = Pick<
  Schema<'CustomerRefOutput'>,
  'first_name' | 'last_name' | 'email'
> & {id: number};

/** "First Last", else the email; null for an order without a customer (a webhook order may have none). */
export function customerName(
  customer: CustomerRef | null | undefined,
): string | null {
  if (!customer) return null;
  const name = [customer.first_name, customer.last_name]
    .filter((part) => part)
    .join(' ');
  return name || customer.email || null;
}

/** The i18n key under orders.sources of a source (1 web, 2 phone). */
export function sourceKey(source: number): 'web' | 'phone' | 'unknown' {
  if (source === 1) return 'web';
  if (source === 2) return 'phone';
  return 'unknown';
}

/** How many orders of the list hold each status (every status, 0 included): the chips' counts. */
export function countByStatus(
  orders: readonly {status: number}[],
): Record<number, number> {
  const counts: Record<number, number> = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, 0]),
  );
  for (const order of orders) {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
  }
  return counts;
}

// en-CA writes YYYY-MM-DD, the value of an <input type="date">.
const DAY = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
});

/** The day (YYYY-MM-DD) an order was created, in Bogota time (where the server writes it); null without a date. */
export function bogotaDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : DAY.format(date);
}

export interface OrderFilter {
  status?: number | null;
  /** Matches the order number, the customer's name or email. */
  query?: string;
  /** First and last creation day kept (YYYY-MM-DD), both included. */
  from?: string;
  to?: string;
}

type Filterable = {
  code?: string | null;
  status: number;
  created_at?: string | null;
  customer?: CustomerRef | null;
};

/** Whether an order passes the list's filters (all of them are client-side, over the loaded list). */
export function matchesOrder(order: Filterable, filter: OrderFilter): boolean {
  if (filter.status != null && order.status !== filter.status) return false;
  const needle = filter.query?.trim().toLowerCase() ?? '';
  if (needle !== '') {
    const haystack = [
      order.code,
      customerName(order.customer),
      order.customer?.email,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  if (filter.from || filter.to) {
    const day = bogotaDay(order.created_at);
    if (day === null) return false;
    if (filter.from && day < filter.from) return false;
    if (filter.to && day > filter.to) return false;
  }
  return true;
}

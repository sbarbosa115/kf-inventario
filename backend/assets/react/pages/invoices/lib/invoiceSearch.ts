import type {ListQuery} from '@/shared/api';

/**
 * What the API is asked for the search box's text. The list shows "Walk-in customer" for an invoice without one, so
 * typing that label (4 letters of it or more) asks for the walk-in invoices (filter[walk_in][]=yes) rather than for
 * a customer of that name; anything else is `q` (docs/pdr/prd-shops-settings.md, Decisions: coordinator note 0.3).
 */
export function invoiceSearch(query: ListQuery, walkInLabel: string): ListQuery {
  const text = (query.q ?? '').trim().toLowerCase();
  if (text.length < 4 || !walkInLabel.toLowerCase().includes(text)) {
    return query;
  }
  return {
    ...query,
    q: undefined,
    filters: {...query.filters, walk_in: ['yes']},
  };
}

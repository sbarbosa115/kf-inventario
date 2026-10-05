import type {OrderPartials, PartialItem} from '../api/recordPartialApi';

/** The rules of the legacy getting-ready screen (PartialHandler.js), as pure functions. */

export type OrderLine = OrderPartials['products'][number];

/** What scanning a code did: added one, or why it was refused (each refusal has its modal). */
export type ScanResult = 'added' | 'not_in_order' | 'no_inventory' | 'limit';

/** Shown instead of a number when nothing of a product is left to add. */
export const COMPLETE = '~';

/** Orders already sent (5) or delivered (6) take no more shipments. */
export const CLOSED_STATUSES = [5, 6];

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** How many of a product earlier partial shipments took. */
export function shippedOf(partials: OrderPartials, uuid: string): number {
  return (
    partials.products_aggregate.find((line) => same(line.uuid, uuid))
      ?.quantity ?? 0
  );
}

/** How many of a product this shipment holds. */
export function currentOf(current: PartialItem[], uuid: string): number {
  return current.find((item) => same(item.uuid, uuid))?.quantity ?? 0;
}

/** How many of a product (by code) the order's warehouse holds. */
export function stockOf(partials: OrderPartials, code: string): number {
  return partials.inventory.find((row) => same(row.code, code))?.quantity ?? 0;
}

/** What is still to add of an order line: ordered − shipped before − this shipment. */
export function leftOf(
  line: OrderLine,
  partials: OrderPartials,
  current: PartialItem[],
): number {
  return (
    line.quantity -
    (shippedOf(partials, line.uuid) + currentOf(current, line.uuid))
  );
}

/** The number the "left" column shows: `~` once the line is complete. */
export function leftLabel(
  line: OrderLine,
  partials: OrderPartials,
  current: PartialItem[],
): string {
  const left = leftOf(line, partials, current);
  return left <= 0 ? COMPLETE : String(left);
}

/** The row's tint: complete, nothing added yet, or some added. */
export function rowClass(
  line: OrderLine,
  partials: OrderPartials,
  current: PartialItem[],
): string {
  const left = leftOf(line, partials, current);
  if (left <= 0) return 'row-selected-completed';
  if (left === line.quantity) return 'row-selected-all-pending';
  return 'row-selected-some-added';
}

/**
 * One more of the product with this code, checked as the legacy screen did: on the order, in the warehouse, and
 * still something left to add. Unlike the legacy screen, the stock check counts what this shipment already holds
 * (the server refuses more than the warehouse has anyway).
 */
export function scan(
  code: string,
  partials: OrderPartials,
  current: PartialItem[],
): {result: ScanResult; current: PartialItem[]} {
  const line = partials.products.find((p) => same(p.product.code, code.trim()));
  if (!line) return {result: 'not_in_order', current};
  if (currentOf(current, line.uuid) >= stockOf(partials, line.product.code)) {
    return {result: 'no_inventory', current};
  }
  if (leftOf(line, partials, current) <= 0) return {result: 'limit', current};

  const exists = current.some((item) => same(item.uuid, line.uuid));
  return {
    result: 'added',
    current: exists
      ? current.map((item) =>
          same(item.uuid, line.uuid)
            ? {...item, quantity: item.quantity + 1}
            : item,
        )
      : [...current, {uuid: line.uuid, quantity: 1}],
  };
}

/** One less of a product in this shipment; a product at zero leaves it. */
export function unscan(current: PartialItem[], uuid: string): PartialItem[] {
  return current
    .map((item) =>
      same(item.uuid, uuid) ? {...item, quantity: item.quantity - 1} : item,
    )
    .filter((item) => item.quantity > 0);
}

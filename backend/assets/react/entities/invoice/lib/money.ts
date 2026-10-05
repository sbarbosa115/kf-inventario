/** Money is worked in cents, so the totals add up the way the server rounds them. */

const toCents = (amount: number) => Math.round(amount * 100);

/** A typed amount as a number: empty or not a number counts as 0. */
export function amountOf(text: string): number {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

export function lineCents(quantity: string, unitPrice: string): number {
  return toCents(amountOf(quantity) * amountOf(unitPrice));
}

export function taxCents(subtotal: number, ratePercent: number): number {
  return Math.round((subtotal * ratePercent) / 100);
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export interface Totals {
  subtotal: number;
  tax: number;
  total: number;
}

/** The invoice's subtotal, the tax of its rate (rounded to the cent) and the total, in cents. */
export function invoiceTotals(
  lines: {quantity: string; unit_price: string}[],
  ratePercent: number,
): Totals {
  const subtotal = lines.reduce(
    (sum, line) => sum + lineCents(line.quantity, line.unit_price),
    0,
  );
  const tax = taxCents(subtotal, ratePercent);
  return {subtotal, tax, total: subtotal + tax};
}

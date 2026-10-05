import {formatCents, invoiceTotals, lineCents} from './money';

describe('the invoice totals', () => {
  it('multiplies the quantity by the unit price in cents', () => {
    expect(lineCents('3', '11.11')).toBe(3333);
    expect(lineCents('', '5')).toBe(0);
    expect(lineCents('2', 'abc')).toBe(0);
  });

  it('adds the lines and the tax of the rate, rounded to the cent as the server does', () => {
    const totals = invoiceTotals(
      [
        {quantity: '3', unit_price: '11.11'},
        {quantity: '1', unit_price: '0.00'},
      ],
      6,
    );

    expect(totals).toEqual({subtotal: 3333, tax: 200, total: 3533});
    expect(formatCents(totals.tax)).toBe('2.00');
  });

  it('has no tax at 0 %', () => {
    expect(invoiceTotals([{quantity: '2', unit_price: '10.50'}], 0)).toEqual({
      subtotal: 2100,
      tax: 0,
      total: 2100,
    });
  });
});

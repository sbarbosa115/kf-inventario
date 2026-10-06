import {customerName, invoiceDay} from './format';

describe('the invoice formats', () => {
  it('keeps the day the server wrote, whatever the time zone', () => {
    expect(invoiceDay('2026-10-05T23:30:00-05:00')).toBe('2026-10-05');
    expect(invoiceDay(null)).toBe('');
  });

  it('names the customer, and nobody for a point-of-sale invoice', () => {
    expect(
      customerName({
        id: 1,
        first_name: 'Ana',
        last_name: 'Gomez',
        email: 'ana@kf.test',
        phone: null,
      }),
    ).toBe('Ana Gomez');
    expect(customerName(null)).toBeNull();
  });
});

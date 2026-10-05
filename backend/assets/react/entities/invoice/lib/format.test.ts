import {customerLabel, formatInvoiceDate} from './format';

describe('the invoice formats', () => {
  it('writes the date as the legacy list did', () => {
    expect(formatInvoiceDate('2026-10-05T23:30:00-05:00')).toBe('05 Oct 2026');
    expect(formatInvoiceDate(null)).toBe('');
  });

  it('names the customer with the email in brackets, and nobody for a point-of-sale invoice', () => {
    expect(
      customerLabel({
        id: 1,
        first_name: 'Ana',
        last_name: 'Gomez',
        email: 'ana@kf.test',
        phone: null,
      }),
    ).toBe('Ana Gomez [ana@kf.test]');
    expect(customerLabel(null)).toBeNull();
  });
});

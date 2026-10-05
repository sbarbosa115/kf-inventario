import {
  customerLabel,
  formatOrderDate,
  formatOrderLongDate,
  ORDER_STATUSES,
  ORDER_STATUS_SENT,
  sourceKey,
} from './order';

describe('the order model', () => {
  it('knows the six statuses in the legacy order, Sent being the one that ships stock', () => {
    expect(ORDER_STATUSES).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ORDER_STATUS_SENT).toBe(5);
  });

  it('names a customer by name and email, as the legacy list did', () => {
    expect(
      customerLabel({
        id: 1,
        first_name: 'Ana',
        last_name: 'Gomez',
        email: 'ana@kf.test',
      }),
    ).toBe('Ana Gomez [ana@kf.test]');
    expect(
      customerLabel({id: 2, first_name: 'Ben'}),
      'no email, no brackets',
    ).toBe('Ben');
    expect(customerLabel(null), 'a webhook order may have none').toBeNull();
  });

  it('names the sources the API sends, and anything else as unknown', () => {
    expect(sourceKey(1)).toBe('web');
    expect(sourceKey(2)).toBe('phone');
    expect(sourceKey(9)).toBe('unknown');
  });

  it('writes dates in Bogota time (where the server writes them), whatever the browser time zone', () => {
    expect(formatOrderDate('2026-10-05T22:30:00-05:00')).toBe('05 Oct 2026');
    expect(formatOrderLongDate('2026-10-05T22:30:00-05:00')).toBe(
      'October 5, 2026',
    );
    expect(formatOrderDate(null)).toBe('');
    expect(formatOrderLongDate(undefined)).toBe('');
  });
});

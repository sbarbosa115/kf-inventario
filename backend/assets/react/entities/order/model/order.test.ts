import {
  bogotaDay,
  countByStatus,
  customerName,
  matchesOrder,
  ORDER_STATUSES,
  ORDER_STATUS_SENT,
  sourceKey,
  statusTone,
} from './order';

const order = (
  status: number,
  extra: Partial<Parameters<typeof matchesOrder>[0]> = {},
) => ({
  id: status,
  code: `W0000${status}`,
  status,
  created_at: '2026-10-05T10:15:00-05:00',
  customer: {
    id: 1,
    first_name: 'Ana',
    last_name: 'Gomez',
    email: 'ana@kf.test',
  },
  ...extra,
});

describe('the order model', () => {
  it('knows the six statuses in the legacy order, Sent being the one that ships stock', () => {
    expect(ORDER_STATUSES).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ORDER_STATUS_SENT).toBe(5);
  });

  it('gives every status a tone, Delivered filled, so the badge never relies on colour alone', () => {
    expect(ORDER_STATUSES.map(statusTone)).toEqual([
      {tone: 'neutral', filled: false},
      {tone: 'info', filled: false},
      {tone: 'accent', filled: false},
      {tone: 'warning', filled: false},
      {tone: 'info', filled: false},
      {tone: 'accent', filled: true},
    ]);
    expect(statusTone(9), 'an unknown status is neutral').toEqual({
      tone: 'neutral',
      filled: false,
    });
  });

  it('names a customer by first and last name; null for an order without one', () => {
    expect(customerName({id: 1, first_name: 'Ana', last_name: 'Gomez'})).toBe(
      'Ana Gomez',
    );
    expect(customerName({id: 2, first_name: 'Ben'})).toBe('Ben');
    expect(
      customerName({id: 3, email: 'x@kf.test'}),
      'no name at all: the email',
    ).toBe('x@kf.test');
    expect(customerName(null), 'a webhook order may have none').toBeNull();
  });

  it('names the sources the API sends, and anything else as unknown', () => {
    expect(sourceKey(1)).toBe('web');
    expect(sourceKey(2)).toBe('phone');
    expect(sourceKey(9)).toBe('unknown');
  });

  it('counts the orders of each status, every status present even at 0', () => {
    expect(countByStatus([order(1), order(1), order(4)])).toEqual({
      1: 2,
      2: 0,
      3: 0,
      4: 1,
      5: 0,
      6: 0,
    });
  });

  it('reads the day an order was created in Bogota, where the server writes it, whatever the browser time zone', () => {
    expect(bogotaDay('2026-10-05T22:30:00-05:00')).toBe('2026-10-05');
    expect(
      bogotaDay('2026-10-06T02:30:00+00:00'),
      'still the 5th in Bogota',
    ).toBe('2026-10-05');
    expect(bogotaDay(null)).toBeNull();
  });

  it('finds an order by its number or its customer, ignoring case', () => {
    expect(matchesOrder(order(1), {query: 'w00001'})).toBe(true);
    expect(matchesOrder(order(1), {query: 'gomez'})).toBe(true);
    expect(matchesOrder(order(1), {query: 'ana@kf'})).toBe(true);
    expect(matchesOrder(order(1), {query: 'ruiz'})).toBe(false);
    expect(
      matchesOrder(order(1, {customer: null}), {query: 'ana'}),
      'no customer, no match by customer',
    ).toBe(false);
  });

  it('keeps the orders of a status, and of a range of creation days, both ends included', () => {
    expect(matchesOrder(order(4), {status: 4})).toBe(true);
    expect(matchesOrder(order(4), {status: 1})).toBe(false);
    const created = order(1);
    expect(matchesOrder(created, {from: '2026-10-05', to: '2026-10-05'})).toBe(
      true,
    );
    expect(matchesOrder(created, {from: '2026-10-06'})).toBe(false);
    expect(matchesOrder(created, {to: '2026-10-04'})).toBe(false);
    expect(
      matchesOrder(order(1, {created_at: null}), {from: '2026-10-01'}),
      'an order without a date is out of any range',
    ).toBe(false);
  });
});

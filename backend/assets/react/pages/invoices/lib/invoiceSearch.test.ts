import {invoiceSearch} from './invoiceSearch';

describe('the invoices search', () => {
  it('asks for the walk-in invoices when the walk-in label is typed', () => {
    expect(invoiceSearch({q: 'walk-in', page: 2}, 'Walk-in customer')).toEqual({
      q: undefined,
      page: 2,
      filters: {walk_in: ['yes']},
    });
  });

  it('is q for anything else, and for fewer than four letters', () => {
    expect(invoiceSearch({q: 'jose'}, 'Walk-in customer')).toEqual({q: 'jose'});
    expect(invoiceSearch({q: 'wal'}, 'Walk-in customer')).toEqual({q: 'wal'});
    expect(invoiceSearch({}, 'Walk-in customer')).toEqual({});
  });
});

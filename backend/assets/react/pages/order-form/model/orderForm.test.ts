import {emptyLine, emptyOrderForm, isOrderFormValid, missingFields} from './orderForm';

describe('missingFields', () => {
  it('names everything an empty order lacks, in the order of the form', () => {
    expect(missingFields(emptyOrderForm())).toEqual([
      'first_name',
      'last_name',
      'email',
      'warehouse',
      'products',
      'source',
      'payment_method',
      'status',
    ]);
  });

  it('counts a product only with a quantity above zero, and ignores blank names', () => {
    const values = {
      ...emptyOrderForm(),
      status: 1,
      source: 2,
      payment_method: 1,
      warehouse_id: 1,
      customer: {
        ...emptyOrderForm().customer,
        first_name: 'Luis',
        last_name: '  ',
        email: 'luis@kf.test',
      },
      products: [{uuid: 'u1', quantity: '0'}, emptyLine()],
    };
    expect(missingFields(values)).toEqual(['last_name', 'products']);
    expect(isOrderFormValid(values)).toBe(false);

    const filled = {
      ...values,
      customer: {...values.customer, last_name: 'Diaz'},
      products: [{uuid: 'u1', quantity: '2'}, emptyLine()],
    };
    expect(missingFields(filled)).toEqual([]);
    expect(isOrderFormValid(filled)).toBe(true);
  });
});

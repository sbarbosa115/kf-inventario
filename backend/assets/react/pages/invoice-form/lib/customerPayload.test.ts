import {noCustomer, customerPayload, pickCustomer} from './customerPayload';

describe('the invoice customer', () => {
  it('sends nobody when nothing was picked or typed', () => {
    expect(customerPayload(noCustomer())).toBeNull();
  });

  it('sends the typed fields without the empty address rows', () => {
    const customer = noCustomer();
    customer.values.first_name = 'Ana';

    expect(customerPayload(customer)).toMatchObject({
      id: null,
      first_name: 'Ana',
      addresses: [],
    });
  });

  it('sends the picked customer by id with what is saved of them', () => {
    const picked = pickCustomer({
      id: 7,
      first_name: 'Ana',
      last_name: 'Gomez',
      email: 'ana@kf.test',
      phone: '3001',
      addresses: [],
    });

    expect(picked.values.addresses).toHaveLength(1);
    expect(customerPayload(picked)).toMatchObject({
      id: 7,
      email: 'ana@kf.test',
      addresses: [],
    });
  });
});

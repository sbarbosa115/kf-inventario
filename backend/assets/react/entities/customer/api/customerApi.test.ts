import {fakeApi} from '@/shared/test/fakeApi';
import {listAllCustomers} from '..';

describe('listAllCustomers', () => {
  it('reads every customer for the order and invoice pickers in one call', async () => {
    const ana = {
      id: 1,
      first_name: 'Ana',
      last_name: 'Diaz',
      email: 'ana@kf.test',
      phone: '555',
      addresses: [],
    };
    const api = fakeApi({'GET /customers/all': [200, [ana]]});

    await expect(listAllCustomers()).resolves.toEqual([ana]);
    expect(
      api.calls.map((call) => `${call.method} ${call.path}`),
      'the pickers list every customer, not a page of the customers screen',
    ).toEqual(['GET /customers/all']);
  });
});

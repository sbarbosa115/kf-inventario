import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {CustomerFormPage} from './CustomerFormPage';

const LOCATIONS = [
  {
    id: 1,
    name: 'Colombia',
    code: 'CO',
    states: [
      {
        id: 10,
        name: 'Antioquia',
        code: 'ANT',
        cities: [{id: 100, name: 'Medellin'}],
      },
    ],
  },
];

const ANA = {
  id: 7,
  first_name: 'Ana',
  last_name: 'Gomez',
  email: 'ana@kf.test',
  phone: '3001',
  addresses: [
    {
      id: 70,
      address: '1 Main St',
      zip_code: '050021',
      address_type: 2,
      city: {
        id: 100,
        name: 'Medellin',
        state: {
          id: 10,
          name: 'Antioquia',
          code: 'ANT',
          country: {id: 1, name: 'Colombia', code: 'CO'},
        },
      },
    },
  ],
};

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/admin/customers" element={<p>customers list</p>} />
          <Route path="/admin/customers/new" element={<CustomerFormPage />} />
          <Route
            path="/admin/customers/:id/edit"
            element={<CustomerFormPage />}
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('CustomerFormPage', () => {
  it('groups the fields in a Contact section and an Addresses section, with the actions in a bar', async () => {
    fakeApi({'GET /locations': [200, LOCATIONS]});
    renderAt('/admin/customers/new');

    const contact = await screen.findByRole('region', {name: 'Contact'});
    expect(within(contact).getByLabelText('Email')).toBeInTheDocument();
    expect(within(contact).getByLabelText('Phone')).toBeInTheDocument();
    const addresses = screen.getByRole('region', {name: 'Addresses'});
    expect(
      within(addresses).getByRole('group', {name: 'Address 1'}),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {level: 1, name: 'New customer'}),
    ).toBeInTheDocument();

    const bar = screen
      .getByRole('button', {name: 'Save'})
      .closest('.kf-action-bar') as HTMLElement;
    expect(bar, 'Save sits in the sticky action bar').not.toBeNull();
    const cancel = within(bar).getByRole('link', {name: 'Cancel'});
    expect(cancel).toHaveAttribute('href', '/admin/customers');
    expect(cancel, 'Cancel is never red').not.toHaveClass('kf-btn--danger');
  });

  it('tells the person with a toast that the customer was saved', async () => {
    fakeApi({
      'GET /locations': [200, LOCATIONS],
      'GET /customers/7': [200, ANA],
      'PUT /customers/7': [200, ANA],
    });
    renderAt('/admin/customers/7/edit');

    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(await screen.findByText('customers list')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'The customer was updated successfully.',
    );
  });

  it('names what is missing and sends nothing', async () => {
    const api = fakeApi({'GET /locations': [200, LOCATIONS]});
    renderAt('/admin/customers/new');

    await userEvent.click(await screen.findByRole('button', {name: 'Save'}));

    expect(
      screen.getAllByText('This value should not be blank.').length,
    ).toBeGreaterThanOrEqual(4);
    expect(api.calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('creates a customer with an existing city and one that is new, then returns to the list', async () => {
    const api = fakeApi({
      'GET /locations': [200, LOCATIONS],
      'POST /customers': [201, ANA],
    });
    renderAt('/admin/customers/new');

    await userEvent.type(await screen.findByLabelText('Name'), 'Ana');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Gomez');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@kf.test');
    await userEvent.type(screen.getByLabelText('Phone'), '3001');
    await userEvent.type(screen.getByLabelText('Address'), '1 Main St');
    await userEvent.type(screen.getByLabelText('Zip Code'), '050021');
    await userEvent.type(screen.getByLabelText('Country'), 'Colombia{enter}');
    await userEvent.type(screen.getByLabelText('State'), 'Antioquia{enter}');
    await userEvent.type(screen.getByLabelText('City'), 'Bello');
    await userEvent.click(await screen.findByText('Create "Bello"'));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByText('customers list')).toBeInTheDocument();
    const sent = api.calls.find((call) => call.method === 'POST')!.body;
    expect(sent).toEqual({
      first_name: 'Ana',
      last_name: 'Gomez',
      email: 'ana@kf.test',
      phone: '3001',
      addresses: [
        {
          id: null,
          address: '1 Main St',
          zip_code: '050021',
          address_type: null,
          city: {
            id: null,
            name: 'Bello',
            state: {
              id: 10,
              name: 'Antioquia',
              country: {id: 1, name: 'Colombia'},
            },
          },
        },
      ],
    });
  });

  it('shows the saved customer and their address on an edit, and saves with PUT', async () => {
    const api = fakeApi({
      'GET /locations': [200, LOCATIONS],
      'GET /customers/7': [200, ANA],
      'PUT /customers/7': [200, ANA],
    });
    renderAt('/admin/customers/7/edit');

    expect(await screen.findByLabelText('Name')).toHaveValue('Ana');
    expect(screen.getByLabelText('Address')).toHaveValue('1 Main St');
    const group = screen.getByRole('group', {name: 'Address 1 · Shipping'});
    expect(within(group).getByText('Colombia')).toBeInTheDocument();
    expect(within(group).getByText('Medellin')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Phone'));
    await userEvent.type(screen.getByLabelText('Phone'), '3002');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByText('customers list')).toBeInTheDocument();
    const put = api.calls.find((call) => call.method === 'PUT')!;
    expect(put.body).toMatchObject({
      phone: '3002',
      addresses: [{id: 70, address_type: 2, city: {id: 100, name: 'Medellin'}}],
    });
  });

  it('says a customer that no longer exists is gone, with a way back', async () => {
    fakeApi({
      'GET /locations': [200, LOCATIONS],
      'GET /customers/999999': [404, {error: 'customer_not_found'}],
    });
    renderAt('/admin/customers/999999/edit');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This customer no longer exists.',
    );
    expect(
      screen.getByRole('link', {name: 'Back to the customers'}),
    ).toHaveAttribute('href', '/admin/customers');
  });

  it('puts the API refusal under its field', async () => {
    fakeApi({
      'GET /locations': [200, LOCATIONS],
      'POST /customers': [
        422,
        {
          error: 'validation_failed',
          violations: [
            {
              field: 'email',
              message: 'This value is not a valid email address.',
            },
          ],
        },
      ],
    });
    renderAt('/admin/customers/new');

    await userEvent.type(await screen.findByLabelText('Name'), 'Ana');
    await userEvent.type(screen.getByLabelText('Last Name'), 'Gomez');
    await userEvent.type(screen.getByLabelText('Email'), 'ana@kf.test');
    await userEvent.type(screen.getByLabelText('Phone'), '3001');
    await userEvent.type(screen.getByLabelText('Address'), 'x');
    await userEvent.type(screen.getByLabelText('Zip Code'), '1');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      await screen.findByText('This value is not a valid email address.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  });
});

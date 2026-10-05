import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {fakeApi} from '@/shared/test/fakeApi';
import {WarehousesPage} from './WarehousesPage';

const COLOMBIA = {id: 1, name: 'Colombia', urls: ['https://colombia.test']};
const USA = {id: 2, name: 'Usa', urls: []};

describe('WarehousesPage', () => {
  it('lists every warehouse with its number and an Edit button', async () => {
    fakeApi({'GET /warehouses': [200, [COLOMBIA, USA]]});
    render(<WarehousesPage />);

    const row = (await screen.findByText('Colombia')).closest('tr')!;
    expect(within(row).getByText('1')).toBeInTheDocument();
    expect(within(row).getByRole('button', {name: /Edit/})).toBeInTheDocument();
    expect(screen.getByText('Usa')).toBeInTheDocument();
  });

  it('renames a warehouse in a modal and shows the new name with a confirmation', async () => {
    let current = COLOMBIA;
    const api = fakeApi({
      'GET /warehouses': () => [200, [current, USA]],
      'PUT /warehouses/1': (body) => {
        current = {...COLOMBIA, name: (body as {name: string}).name};
        return [200, current];
      },
    });
    render(<WarehousesPage />);

    const row = (await screen.findByText('Colombia')).closest('tr')!;
    await userEvent.click(within(row).getByRole('button', {name: /Edit/}));
    const dialog = screen.getByRole('dialog', {name: 'Edit warehouse'});
    const name = within(dialog).getByLabelText('Name');
    expect(name).toHaveValue('Colombia');
    await userEvent.clear(name);
    await userEvent.type(name, 'Bogota');
    await userEvent.click(within(dialog).getByRole('button', {name: 'Save'}));

    expect(await screen.findByText('Bogota')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Warehouse updated successfully',
    );
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Bogota',
    });
  });

  it('does not send a blank name and says why', async () => {
    const api = fakeApi({'GET /warehouses': [200, [COLOMBIA]]});
    render(<WarehousesPage />);

    await userEvent.click(await screen.findByRole('button', {name: /Edit/}));
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      screen.getByText('This value should not be blank.'),
    ).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  });

  it('keeps the modal open and says so when the warehouse no longer exists', async () => {
    fakeApi({
      'GET /warehouses': [200, [COLOMBIA]],
      'PUT /warehouses/1': [404, {error: 'warehouse_not_found'}],
    });
    render(<WarehousesPage />);

    await userEvent.click(await screen.findByRole('button', {name: /Edit/}));
    await userEvent.type(screen.getByLabelText('Name'), ' 2');
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This warehouse no longer exists.',
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('says what to do when there are no warehouses', async () => {
    fakeApi({'GET /warehouses': [200, []]});
    render(<WarehousesPage />);

    expect(
      await screen.findByText('There are no warehouses yet.'),
    ).toBeInTheDocument();
  });

  it('shows the failure with a retry when the list cannot be loaded', async () => {
    fakeApi({'GET /warehouses': [500, {error: 'internal_error'}]});
    render(<WarehousesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(screen.getByRole('button', {name: 'Try again'})).toBeInTheDocument();
  });
});

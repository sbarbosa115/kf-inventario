import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {WarehousesPage} from './WarehousesPage';

const COLOMBIA = {
  id: 1,
  name: 'Colombia',
  urls: ['https://shop-co.test', 'https://shop-two.test'],
};
const USA = {id: 2, name: 'Usa', urls: []};

function renderPage() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <WarehousesPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const card = async (name: string) =>
  (await screen.findAllByRole('article')).find((item) =>
    within(item).queryByRole('heading', {name}),
  )!;

describe('WarehousesPage', () => {
  it('shows a card per warehouse with the shop addresses its orders come from', async () => {
    fakeApi({'GET /warehouses': [200, [COLOMBIA, USA]]});
    renderPage();

    expect(
      screen.getByRole('heading', {level: 1, name: 'Warehouses'}),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole('article')).toHaveLength(2);
    const colombia = await card('Colombia');
    expect(within(colombia).getByText('https://shop-co.test')).toBeInTheDocument();
    expect(within(colombia).getByText('https://shop-two.test')).toBeInTheDocument();
    expect(
      within(await card('Usa')).getByText('No shop sends its orders here.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table'), 'cards, not a table').toBeNull();
    expect(screen.queryByRole('dialog'), 'no modal').toBeNull();
  });

  it('renames in place: a click on the name, Enter saves, and the card shows the new name', async () => {
    let current = COLOMBIA;
    const api = fakeApi({
      'GET /warehouses': () => [200, [current, USA]],
      'PUT /warehouses/1': (body) => {
        current = {...COLOMBIA, name: (body as {name: string}).name};
        return [200, current];
      },
    });
    renderPage();

    await userEvent.click(
      within(await card('Colombia')).getByRole('button', {name: 'Colombia'}),
    );
    const name = screen.getByLabelText('New name for Colombia');
    expect(name).toHaveValue('Colombia');
    expect(name).toHaveFocus();
    await userEvent.clear(name);
    await userEvent.type(name, 'Bogota{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Colombia is now Bogota.',
    );
    expect(
      await screen.findByRole('heading', {name: 'Bogota'}),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/New name for/)).toBeNull();
    expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
      name: 'Bogota',
    });
  });

  it('renames from the card menu too, and Escape cancels without sending', async () => {
    const api = fakeApi({'GET /warehouses': [200, [COLOMBIA, USA]]});
    renderPage();

    await userEvent.click(
      within(await card('Usa')).getByRole('button', {name: 'Actions for Usa'}),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: 'Rename'}));
    const name = screen.getByLabelText('New name for Usa');
    await userEvent.type(name, ' East{Escape}');

    expect(screen.queryByLabelText('New name for Usa')).toBeNull();
    expect(screen.getByRole('heading', {name: 'Usa'})).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  });

  it('does not send a blank name and says what to do', async () => {
    const api = fakeApi({'GET /warehouses': [200, [COLOMBIA]]});
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Colombia'}),
    );
    await userEvent.clear(screen.getByLabelText('New name for Colombia'));
    await userEvent.click(screen.getByRole('button', {name: 'Save'}));

    expect(
      screen.getByText('Type a name for the warehouse.'),
    ).toBeInTheDocument();
    expect(api.calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
  });

  it('keeps the name being edited and says so when the warehouse no longer exists', async () => {
    fakeApi({
      'GET /warehouses': [200, [COLOMBIA]],
      'PUT /warehouses/1': [404, {error: 'warehouse_not_found'}],
    });
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Colombia'}),
    );
    await userEvent.type(
      screen.getByLabelText('New name for Colombia'),
      ' 2{Enter}',
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This warehouse no longer exists.',
    );
    expect(screen.getByLabelText('New name for Colombia')).toHaveValue(
      'Colombia 2',
    );
  });

  it('says so when there are no warehouses', async () => {
    fakeApi({'GET /warehouses': [200, []]});
    renderPage();

    expect(
      await screen.findByText('There are no warehouses yet.'),
    ).toBeInTheDocument();
  });

  it('shows the failure with a retry when the list cannot be loaded', async () => {
    fakeApi({'GET /warehouses': [500, {error: 'internal_error'}]});
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on our side',
    );
    expect(screen.getByRole('button', {name: 'Try again'})).toBeInTheDocument();
  });
});

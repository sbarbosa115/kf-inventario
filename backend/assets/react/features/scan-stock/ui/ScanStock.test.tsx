import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {ScanStock} from './ScanStock';

const WAREHOUSES = [
  {id: 1, name: 'Colombia', urls: []},
  {id: 2, name: 'Usa', urls: []},
];
const PRODUCT = {
  id: 1,
  uuid: 'u1',
  code: 'KF-01',
  title: 'KF-01',
  stock: [],
};

async function scan(code: string) {
  const input = screen.getByPlaceholderText('Bar code');
  await userEvent.type(input, `${code}{Enter}`);
}

describe('ScanStock', () => {
  it('adds the code to the list when Enter is pressed and clears the box', async () => {
    fakeApi({'GET /products/by-code/KF-01': [200, PRODUCT]});
    render(<ScanStock warehouses={WAREHOUSES} />);

    await scan('KF-01');

    const row = screen.getByText('KF-01').closest('tr')!;
    expect(within(row).getByLabelText('Quantity of KF-01')).toHaveValue('1');
    expect(screen.getByPlaceholderText('Bar code')).toHaveValue('');
  });

  it('raises the quantity by one each time the same code is read again, with one lookup', async () => {
    const api = fakeApi({'GET /products/by-code/KF-01': [200, PRODUCT]});
    render(<ScanStock warehouses={WAREHOUSES} />);

    await scan('KF-01');
    await scan('KF-01');
    await scan('KF-01');

    expect(screen.getByLabelText('Quantity of KF-01')).toHaveValue('3');
    expect(screen.getAllByText('KF-01')).toHaveLength(1);
    expect(api.calls).toHaveLength(1);
  });

  it('ignores an empty box', async () => {
    fakeApi({});
    render(<ScanStock warehouses={WAREHOUSES} />);

    await userEvent.type(screen.getByPlaceholderText('Bar code'), '{Enter}');

    expect(screen.getByText('No products read yet.')).toBeInTheDocument();
  });

  it('marks a code that exists and one that does not', async () => {
    fakeApi({
      'GET /products/by-code/KF-01': [200, PRODUCT],
      'GET /products/by-code/NOPE': [404, {error: 'product_not_found'}],
    });
    render(<ScanStock warehouses={WAREHOUSES} />);

    await scan('KF-01');
    await scan('NOPE');

    expect(await screen.findByTitle('The product exists')).toBeInTheDocument();
    expect(
      await screen.findByTitle('The product does not exist'),
    ).toBeInTheDocument();
  });

  it('shows the product as being checked until the lookup answers', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );
    render(<ScanStock warehouses={WAREHOUSES} />);

    await scan('KF-01');
    expect(screen.getByTitle('Checking the product…')).toBeInTheDocument();
    await act(async () => answer(new Response(JSON.stringify(PRODUCT))));

    expect(await screen.findByTitle('The product exists')).toBeInTheDocument();
    expect(
      screen.queryByTitle('Checking the product…'),
    ).not.toBeInTheDocument();
  });

  it('lets the quantity be edited and the row be removed', async () => {
    fakeApi({'GET /products/by-code/KF-01': [200, PRODUCT]});
    render(<ScanStock warehouses={WAREHOUSES} />);
    await scan('KF-01');

    const quantity = screen.getByLabelText('Quantity of KF-01');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '12');
    expect(quantity).toHaveValue('12');

    await userEvent.click(screen.getByRole('button', {name: 'Remove KF-01'}));
    expect(screen.getByText('No products read yet.')).toBeInTheDocument();
  });

  it('keeps Add and Remove disabled until there is a product and a warehouse', async () => {
    fakeApi({'GET /products/by-code/KF-01': [200, PRODUCT]});
    render(<ScanStock warehouses={WAREHOUSES} />);
    const add = screen.getByRole('button', {name: 'Add products'});
    const remove = screen.getByRole('button', {name: 'Remove products'});
    expect(add).toBeDisabled();
    expect(remove).toBeDisabled();

    await scan('KF-01');
    expect(add).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByLabelText('Warehouse'),
      'Colombia',
    );

    expect(add).toBeEnabled();
    expect(remove).toBeEnabled();
  });

  it('confirms, then posts the codes and quantities to add and empties the list', async () => {
    const api = fakeApi({
      'GET /products/by-code/KF-01': [200, PRODUCT],
      'POST /warehouses/2/stock/add': [204],
    });
    render(<ScanStock warehouses={WAREHOUSES} />);
    await scan('KF-01');
    await scan('KF-01');
    await userEvent.selectOptions(screen.getByLabelText('Warehouse'), 'Usa');

    await userEvent.click(screen.getByRole('button', {name: 'Add products'}));
    const dialog = screen.getByRole('dialog', {name: 'Confirm the products'});
    expect(dialog).toHaveTextContent('These products will go to Usa');
    expect(within(dialog).getByText('KF-01')).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Add quantity'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The products were added to Usa.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('No products read yet.')).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      items: [{code: 'KF-01', quantity: 2}],
    });
  });

  it('confirms, then posts to remove', async () => {
    const api = fakeApi({
      'GET /products/by-code/KF-01': [200, PRODUCT],
      'POST /warehouses/1/stock/remove': [204],
    });
    render(<ScanStock warehouses={WAREHOUSES} />);
    await scan('KF-01');
    await userEvent.selectOptions(
      screen.getByLabelText('Warehouse'),
      'Colombia',
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Remove products'}),
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Remove quantity'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'The products were removed from Colombia.',
    );
    expect(api.calls.find((c) => c.method === 'POST')?.path).toBe(
      '/warehouses/1/stock/remove',
    );
  });

  it('keeps the list and says what is missing when the stock is not enough', async () => {
    fakeApi({
      'GET /products/by-code/KF-01': [200, PRODUCT],
      'POST /warehouses/1/stock/remove': [
        422,
        {
          error: 'insufficient_stock',
          message: 'x',
          detail: {code: 'KF-01', available: 3},
        },
      ],
    });
    render(<ScanStock warehouses={WAREHOUSES} />);
    await scan('KF-01');
    await userEvent.selectOptions(
      screen.getByLabelText('Warehouse'),
      'Colombia',
    );

    await userEvent.click(
      screen.getByRole('button', {name: 'Remove products'}),
    );
    await userEvent.click(
      screen.getByRole('button', {name: 'Remove quantity'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is not enough stock of KF-01: 3 available.',
    );
    expect(screen.getByLabelText('Quantity of KF-01')).toBeInTheDocument();
  });

  it('does not offer to send a quantity that is not a whole number of 1 or more', async () => {
    fakeApi({'GET /products/by-code/KF-01': [200, PRODUCT]});
    render(<ScanStock warehouses={WAREHOUSES} />);
    await scan('KF-01');
    await userEvent.selectOptions(
      screen.getByLabelText('Warehouse'),
      'Colombia',
    );
    const quantity = screen.getByLabelText('Quantity of KF-01');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '0');

    expect(
      screen.getByText('Every quantity must be a whole number of 1 or more.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add products'})).toBeDisabled();
  });
});

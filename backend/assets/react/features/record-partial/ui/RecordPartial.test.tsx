import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import type {OrderPartials} from '../api/recordPartialApi';
import {RecordPartial} from './RecordPartial';

const UUID_1 = 'aaaa-0001';
const UUID_2 = 'aaaa-0002';

const stock = (uuid: string, code: string, quantity: number) => ({
  id: 1,
  status: 1,
  quantity,
  product_id: 1,
  uuid,
  code,
  title: code,
  detail: null,
  price: null,
  warehouse: {id: 1, name: 'Colombia'},
});

const PARTIALS: OrderPartials = {
  order_id: 7,
  code: 'W00007',
  status: 1,
  products: [
    {
      uuid: UUID_1,
      quantity: 3,
      product: {code: 'KF-01', title: 'KF-01', detail: 'Chair'},
    },
    {
      uuid: UUID_2,
      quantity: 2,
      product: {code: 'KF-02', title: 'KF-02', detail: 'Table'},
    },
  ],
  // One KF-01 left in an earlier partial shipment.
  products_aggregate: [{uuid: UUID_1, quantity: 1, product: {code: 'KF-01'}}],
  pending: [
    {uuid: UUID_1, quantity: 2},
    {uuid: UUID_2, quantity: 2},
  ],
  inventory: [stock(UUID_1, 'KF-01', 10), stock(UUID_2, 'KF-02', 1)],
};

function renderIt(partials: OrderPartials = PARTIALS, onSaved = vi.fn()) {
  render(
    <MemoryRouter>
      <RecordPartial partials={partials} onSaved={onSaved} />
    </MemoryRouter>,
  );
  return onSaved;
}

const rowOf = (code: string) =>
  screen.getByRole('row', {name: new RegExp(`\\b${code}\\b`)});

async function scan(code: string) {
  const input = screen.getByLabelText('Bar Code');
  await userEvent.clear(input);
  await userEvent.type(input, `${code}{Enter}`);
}

describe('RecordPartial', () => {
  it('lists every product of the order with its stock, what is left and what was shipped', () => {
    renderIt();

    const kf01 = within(rowOf('KF-01'));
    expect(kf01.getByText('Chair')).toBeInTheDocument();
    expect(
      kf01.getByRole('button', {name: /10/}),
      'the stock button shows what the warehouse holds',
    ).toBeInTheDocument();
    expect(
      kf01.getByText('3 / 2'),
      'ordered / left once the earlier shipment is counted',
    ).toBeInTheDocument();
    expect(kf01.getByLabelText('This Order')).toHaveValue(0);
    expect(rowOf('KF-01')).toHaveClass('row-selected-some-added');
    expect(rowOf('KF-02')).toHaveClass('row-selected-all-pending');
  });

  it('focuses the barcode field, and Enter adds one of the scanned product', async () => {
    renderIt();
    expect(screen.getByLabelText('Bar Code')).toHaveFocus();

    await scan('kf-01');

    expect(within(rowOf('KF-01')).getByLabelText('This Order')).toHaveValue(1);
    expect(within(rowOf('KF-01')).getByText('3 / 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Bar Code')).toHaveValue('');
  });

  it('shows ~ once the order has all of a product, and refuses one more with the limit modal', async () => {
    renderIt();

    await scan('KF-01');
    await scan('KF-01');

    const row = within(rowOf('KF-01'));
    expect(row.getByText('3 / ~')).toBeInTheDocument();
    expect(rowOf('KF-01')).toHaveClass('row-selected-completed');
    expect(
      row.getByRole('button', {name: 'Add one'}),
      'nothing left to add',
    ).toBeDisabled();

    await scan('KF-01');
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'You reached the limit of product allowed to add to this order.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Continue adding'}),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(row.getByLabelText('This Order')).toHaveValue(2);
    expect(screen.getByLabelText('Bar Code')).toHaveFocus();
  });

  it('refuses a product that is not on the order', async () => {
    renderIt();

    await scan('XX-99');

    expect(
      within(screen.getByRole('dialog')).getByText(
        'You are trying to add a product that is not on the current order, please click to continue.',
      ),
    ).toBeInTheDocument();
  });

  it('refuses more than the warehouse holds with the inventory modal', async () => {
    renderIt();

    await scan('KF-02');
    expect(within(rowOf('KF-02')).getByLabelText('This Order')).toHaveValue(1);
    await scan('KF-02');

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'There is no enough quantity of this product on inventory.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Continue'}),
    );
    expect(within(rowOf('KF-02')).getByLabelText('This Order')).toHaveValue(1);
  });

  it('adds and takes away one with the + and − buttons', async () => {
    renderIt();
    const row = within(rowOf('KF-02'));
    expect(row.getByRole('button', {name: 'Remove one'})).toBeDisabled();

    await userEvent.click(row.getByRole('button', {name: 'Add one'}));
    expect(row.getByLabelText('This Order')).toHaveValue(1);
    expect(rowOf('KF-02')).toHaveClass('row-selected-some-added');

    await userEvent.click(row.getByRole('button', {name: 'Remove one'}));
    expect(row.getByLabelText('This Order')).toHaveValue(0);
    expect(rowOf('KF-02')).toHaveClass('row-selected-all-pending');
  });

  it('sends what this shipment holds and hands the answer back', async () => {
    const api = fakeApi({
      'POST /orders/7/partials': [200, {...PARTIALS, status: 4}],
    });
    const onSaved = renderIt();
    const save = screen.getByRole('button', {name: 'Save Current'});
    expect(save, 'nothing to send yet').toBeDisabled();

    await scan('KF-01');
    await scan('KF-02');
    await userEvent.click(save);

    expect(api.calls).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/orders/7/partials',
        body: {
          items: [
            {uuid: UUID_1, quantity: 1},
            {uuid: UUID_2, quantity: 1},
          ],
        },
      }),
    ]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({status: 4}));
  });

  it('says why the server refused the shipment', async () => {
    fakeApi({
      'POST /orders/7/partials': [
        422,
        {
          error: 'insufficient_stock',
          message: 'Not enough',
          detail: {code: 'KF-01', available: 0},
        },
      ],
    });
    const onSaved = renderIt();

    await scan('KF-01');
    await userEvent.click(screen.getByRole('button', {name: 'Save Current'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The warehouse does not hold enough of KF-01 (0 available).',
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', {name: 'Save Current'}),
    ).not.toBeDisabled();
  });

  it.each([5, 6])(
    'cannot save an order that is already sent or delivered (status %i)',
    async (status) => {
      renderIt({...PARTIALS, status});

      expect(screen.getByRole('button', {name: 'Save Current'})).toBeDisabled();
    },
  );

  it('says so when the order has no products', () => {
    renderIt({...PARTIALS, products: [], inventory: []});

    expect(screen.getByText('No products were found')).toBeInTheDocument();
  });
});

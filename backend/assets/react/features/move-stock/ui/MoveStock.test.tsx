import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {StockItem} from '@/entities/product';
import type {Warehouse} from '@/entities/warehouse';
import {fakeApi} from '@/shared/test/fakeApi';
import {MoveStockModal} from './MoveStockModal';

const COLOMBIA: Warehouse = {id: 1, name: 'Colombia', urls: []};
const USA: Warehouse = {id: 2, name: 'Usa', urls: []};
const SPAIN: Warehouse = {id: 3, name: 'España', urls: []};

function stock(id: number, code: string, quantity: number): StockItem {
  return {
    id,
    status: 1,
    quantity,
    product_id: id,
    uuid: `uuid-${code}`,
    code,
    title: `Title ${code}`,
    detail: null,
    price: 10,
    warehouse: {id: COLOMBIA.id, name: COLOMBIA.name},
  };
}

function renderModal(
  rows: StockItem[],
  warehouses: Warehouse[] = [COLOMBIA, USA, SPAIN],
) {
  const onMoved = vi.fn();
  const onClose = vi.fn();
  render(
    <MoveStockModal
      rows={rows}
      source={COLOMBIA}
      warehouses={warehouses}
      onMoved={onMoved}
      onClose={onClose}
    />,
  );
  return {onMoved, onClose};
}

describe('MoveStock', () => {
  it('offers from 1 to the quantity available for each selected product, starting at 1', () => {
    fakeApi({});
    renderModal([stock(1, 'KF-01', 4), stock(2, 'KF-02', 0)]);

    const quantity = screen.getByRole('combobox', {name: 'Quantity of KF-01'});
    expect(
      within(quantity)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['1', '2', '3', '4']);
    expect(quantity).toHaveValue('1');
    expect(
      screen.queryByRole('combobox', {name: 'Quantity of KF-02'}),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Product quantity is 0')).toBeInTheDocument();
  });

  it('lists every warehouse but the one the stock leaves as the destination', () => {
    fakeApi({});
    renderModal([stock(1, 'KF-01', 4)]);

    const destination = screen.getByRole('combobox', {
      name: 'Destination Warehouse',
    });
    expect(
      within(destination)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Usa', 'España']);
    expect(destination).toHaveValue('2');
  });

  it('posts every product with stock and its chosen quantity to the chosen warehouse', async () => {
    const api = fakeApi({'POST /warehouses/1/moves/3': [204]});
    const {onMoved} = renderModal([
      stock(1, 'KF-01', 4),
      stock(2, 'KF-02', 9),
      stock(3, 'KF-03', 0),
    ]);

    await userEvent.selectOptions(
      screen.getByRole('combobox', {name: 'Destination Warehouse'}),
      'España',
    );
    await userEvent.selectOptions(
      screen.getByRole('combobox', {name: 'Quantity of KF-02'}),
      '7',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Move'}));

    await vi.waitFor(() => expect(onMoved).toHaveBeenCalledWith(SPAIN));
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]!.body).toEqual({
      items: [
        {uuid: 'uuid-KF-01', quantity: 1},
        {uuid: 'uuid-KF-02', quantity: 7},
      ],
    });
  });

  it('says how many are left when the warehouse no longer holds that many, and lets the person try again', async () => {
    fakeApi({
      'POST /warehouses/1/moves/2': [
        422,
        {
          error: 'insufficient_stock',
          message: 'Only 2 of KF-01 are available.',
          detail: {code: 'KF-01', available: 2},
        },
      ],
    });
    const {onMoved} = renderModal([stock(1, 'KF-01', 4)]);

    await userEvent.selectOptions(
      screen.getByRole('combobox', {name: 'Quantity of KF-01'}),
      '4',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Move'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Only 2 of KF-01 are available.',
    );
    expect(screen.getByRole('button', {name: 'Move'})).toBeEnabled();
    expect(onMoved).not.toHaveBeenCalled();
  });

  it('cannot move anything when there is no other warehouse', () => {
    fakeApi({});
    renderModal([stock(1, 'KF-01', 4)], [COLOMBIA]);

    expect(
      screen.getByText('There is no other warehouse to move products to.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Move'})).toBeDisabled();
  });

  it('cannot move anything when no selected product has stock', () => {
    fakeApi({});
    renderModal([stock(1, 'KF-01', 0)]);

    expect(
      screen.getByText('None of the selected products has stock to move.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Move'})).toBeDisabled();
  });

  it('closes without moving anything', async () => {
    const api = fakeApi({});
    const {onClose} = renderModal([stock(1, 'KF-01', 4)]);

    await userEvent.click(screen.getAllByRole('button', {name: 'Close'})[1]!);

    expect(onClose).toHaveBeenCalled();
    expect(api.calls).toHaveLength(0);
  });
});

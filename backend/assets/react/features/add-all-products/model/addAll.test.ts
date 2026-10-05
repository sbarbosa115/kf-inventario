import {emptyLine} from '@/entities/invoice';
import type {StockItem} from '@/entities/product';
import {addAllProducts} from './addAll';

const stock = (id: number, title: string, price: number | null) =>
  ({
    id: id * 10,
    status: 1,
    quantity: 4,
    product_id: id,
    uuid: `u${id}`,
    code: `KF-${id}`,
    title,
    price,
    warehouse: {id: 1, name: 'Colombia'},
  }) as StockItem;

describe('add all products', () => {
  it('adds a line for every product that is not on the invoice, with its title and price', () => {
    const chair = {
      ...emptyLine(),
      product_id: 1,
      description: 'Chair',
      unit_price: '5',
    };

    const lines = addAllProducts(
      [stock(1, 'Chair', 5), stock(2, 'Table', 12.5), stock(3, 'Lamp', null)],
      [chair],
    );

    expect(
      lines.map((l) => [l.product_id, l.description, l.quantity, l.unit_price]),
    ).toEqual([
      [1, 'Chair', '1', '5'],
      [2, 'Table', '1', '12.5'],
      [3, 'Lamp', '1', '0'],
    ]);
  });

  it('replaces the empty row the form starts with', () => {
    expect(addAllProducts([stock(1, 'Chair', 5)], [emptyLine()])).toHaveLength(
      1,
    );
  });
});

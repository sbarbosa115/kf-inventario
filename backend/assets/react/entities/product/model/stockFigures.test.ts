import type {StockItem} from '../api/productApi';
import {matchesStock, stockFigures, type StockFilter} from './stockFigures';

function row(code: string, quantity: number, price: number | null): StockItem {
  return {
    id: 1,
    status: 1,
    quantity,
    product_id: 1,
    uuid: code,
    code,
    title: `Title ${code}`,
    detail: null,
    price,
    warehouse: {id: 1, name: 'Colombia'},
  };
}

describe('stockFigures', () => {
  it('counts products, sums units and values stock by quantity times price', () => {
    const figures = stockFigures([
      row('A', 10, 2.5),
      row('B', 3, 100),
      row('C', 0, 9),
      row('D', 4, null),
    ]);

    expect(figures).toEqual({
      products: 4,
      units: 17,
      value: 325,
      inStock: 3,
      outOfStock: 1,
    });
  });

  it('is zero for an empty list', () => {
    expect(stockFigures([])).toEqual({
      products: 0,
      units: 0,
      value: 0,
      inStock: 0,
      outOfStock: 0,
    });
  });
});

describe('matchesStock', () => {
  const cases: [StockFilter | null, number, boolean][] = [
    [null, 0, true],
    [null, 5, true],
    ['in', 5, true],
    ['in', 0, false],
    ['out', 0, true],
    ['out', 5, false],
  ];
  it.each(cases)(
    'chip %s with quantity %i keeps the row: %s',
    (chip, quantity, kept) => {
      expect(matchesStock(row('A', quantity, 1), chip)).toBe(kept);
    },
  );
});

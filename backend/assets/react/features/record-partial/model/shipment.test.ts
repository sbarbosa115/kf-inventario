import type {OrderPartials} from '../api/recordPartialApi';
import {lineState, scan, shipmentUnits} from './shipment';

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

const line = (uuid: string, code: string, quantity: number) => ({
  uuid,
  quantity,
  product: {code, title: `Title ${code}`, detail: null},
});

const KF01 = line('u1', 'KF-01', 3);
const KF02 = line('u2', 'KF-02', 2);
const KF03 = line('u3', 'KF-03', 1);

// KF-01: 3 ordered, 1 shipped before, 10 in stock. KF-02: 2 ordered, 1 in stock. KF-03: 1 ordered, all shipped.
const PARTIALS: OrderPartials = {
  order_id: 7,
  code: 'W00007',
  status: 4,
  products: [KF01, KF02, KF03],
  products_aggregate: [
    {uuid: 'u1', quantity: 1, product: {code: 'KF-01'}},
    {uuid: 'u3', quantity: 1, product: {code: 'KF-03'}},
  ],
  pending: [],
  inventory: [
    stock('u1', 'KF-01', 10),
    stock('u2', 'KF-02', 1),
    stock('u3', 'KF-03', 5),
  ],
};

describe('lineState', () => {
  it('is pending, not alarming, while something is left and the warehouse holds it', () => {
    expect(lineState(KF01, PARTIALS, [])).toBe('pending');
    expect(
      lineState(KF01, PARTIALS, [{uuid: 'u1', quantity: 1}]),
      'some in this shipment, one still left',
    ).toBe('pending');
  });

  it('is complete when this shipment holds what was left', () => {
    expect(lineState(KF01, PARTIALS, [{uuid: 'u1', quantity: 2}])).toBe(
      'complete',
    );
  });

  it('is shipped when earlier shipments took all of it', () => {
    expect(lineState(KF03, PARTIALS, [])).toBe('shipped');
  });

  it('is short when the warehouse holds fewer than what is left to ship', () => {
    expect(lineState(KF02, PARTIALS, []), '2 left, 1 in stock').toBe('short');
    expect(
      lineState(KF02, PARTIALS, [{uuid: 'u2', quantity: 1}]),
      'the stock counts what this shipment already holds',
    ).toBe('short');
  });
});

describe('scan', () => {
  it('names the product line it added or refused', () => {
    expect(scan('kf-01', PARTIALS, [])).toMatchObject({
      result: 'added',
      line: KF01,
      current: [{uuid: 'u1', quantity: 1}],
    });
    expect(scan('KF-03', PARTIALS, [])).toMatchObject({
      result: 'limit',
      line: KF03,
    });
    const unknown = scan('XX-99', PARTIALS, []);
    expect(unknown.result).toBe('not_in_order');
    expect(unknown.line).toBeUndefined();
  });
});

describe('shipmentUnits', () => {
  it('adds up the units of this shipment', () => {
    expect(shipmentUnits([])).toBe(0);
    expect(
      shipmentUnits([
        {uuid: 'u1', quantity: 2},
        {uuid: 'u2', quantity: 1},
      ]),
    ).toBe(3);
  });
});

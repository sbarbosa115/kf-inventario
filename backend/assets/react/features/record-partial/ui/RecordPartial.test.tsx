import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import type {DetectorFactory} from '@/shared/lib';
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
      product: {code: 'KF-01', title: 'Front bumper', detail: 'Chrome'},
    },
    {
      uuid: UUID_2,
      quantity: 2,
      product: {code: 'KF-02', title: 'Rear spoiler', detail: null},
    },
  ],
  // One KF-01 left in an earlier partial shipment.
  products_aggregate: [{uuid: UUID_1, quantity: 1, product: {code: 'KF-01'}}],
  pending: [
    {uuid: UUID_1, quantity: 2},
    {uuid: UUID_2, quantity: 2},
  ],
  // KF-02: two ordered, one in the warehouse.
  inventory: [stock(UUID_1, 'KF-01', 10), stock(UUID_2, 'KF-02', 1)],
};

function renderIt(
  partials: OrderPartials = PARTIALS,
  onSaved = vi.fn(),
  detector?: DetectorFactory,
) {
  render(
    <MemoryRouter>
      <RecordPartial
        partials={partials}
        onSaved={onSaved}
        detector={detector}
      />
    </MemoryRouter>,
  );
  return onSaved;
}

const barcode = () => screen.getByLabelText('Barcode');

/** One product of the order, by its code. */
const line = (code: string) => screen.getByRole('listitem', {name: code});

/** One read, typed like a person: ScanInput takes an Enter within 50 ms of the last read for the same scanner burst. */
async function scan(code: string) {
  await new Promise((resolve) => setTimeout(resolve, 60));
  await userEvent.type(barcode(), `${code}{Enter}`);
}

const shipButton = () => screen.getByRole('button', {name: /^Ship/});

describe('RecordPartial', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('lists every product with its progress and its stock, and starts neutral', () => {
    renderIt();

    const kf01 = within(line('KF-01'));
    expect(kf01.getByText('Front bumper')).toBeInTheDocument();
    expect(
      kf01.getByText('Shipped 1 of 3 · this shipment 0'),
      'the progress replaces "3 / 2" and "Aggregate Partials"',
    ).toBeInTheDocument();
    expect(kf01.getByText('In stock 10')).toBeInTheDocument();
    expect(
      kf01.queryByRole('button', {name: /10/}),
      'the stock is text, not a button',
    ).not.toBeInTheDocument();
    const bar = kf01.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(line('KF-01'), 'nothing happened yet: no tint').not.toHaveClass(
      'is-complete',
    );
    expect(line('KF-01')).not.toHaveClass('is-short');
  });

  it('warns, in words, when the warehouse holds fewer than what is left', () => {
    renderIt();

    expect(line('KF-02')).toHaveClass('is-short');
    expect(
      within(line('KF-02')).getByText('Short of stock'),
    ).toBeInTheDocument();
    expect(line('KF-01')).not.toHaveClass('is-short');
  });

  it('focuses the barcode box, and Enter adds one of the scanned product and keeps the focus', async () => {
    renderIt();
    expect(barcode()).toHaveFocus();

    await scan('kf-01');

    const kf01 = within(line('KF-01'));
    expect(
      kf01.getByText('Shipped 1 of 3 · this shipment 1'),
    ).toBeInTheDocument();
    expect(kf01.getByLabelText('This shipment of KF-01')).toHaveTextContent(
      '1',
    );
    expect(kf01.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(barcode()).toHaveValue('');
    expect(barcode()).toHaveFocus();
  });

  it('turns a row complete when this shipment completes it, and refuses one more inline without taking the focus', async () => {
    renderIt();

    await scan('KF-01');
    await scan('KF-01');

    expect(line('KF-01')).toHaveClass('is-complete');
    expect(within(line('KF-01')).getByText('Complete')).toBeInTheDocument();
    expect(
      within(line('KF-01')).getByRole('button', {name: 'One more KF-01'}),
      'nothing left to add',
    ).toBeDisabled();

    await scan('KF-01');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nothing more of KF-01 is left to ship.',
    );
    expect(screen.queryByRole('dialog'), 'no modal').not.toBeInTheDocument();
    expect(barcode(), 'the scanner keeps the focus').toHaveFocus();
    expect(
      within(line('KF-01')).getByLabelText('This shipment of KF-01'),
    ).toHaveTextContent('2');
  });

  it('refuses a product that is not on the order inline, and clears the refusal on the next good scan', async () => {
    renderIt();

    await scan('XX-99');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'XX-99 is not on this order.',
    );
    expect(barcode()).toHaveFocus();

    await scan('KF-01');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses more than the warehouse holds inline', async () => {
    renderIt();

    await scan('KF-02');
    await scan('KF-02');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The warehouse holds no more KF-02.',
    );
    expect(barcode()).toHaveFocus();
    expect(
      within(line('KF-02')).getByLabelText('This shipment of KF-02'),
    ).toHaveTextContent('1');
  });

  it('adds and takes away one with the stepper', async () => {
    renderIt();
    const kf01 = within(line('KF-01'));
    expect(kf01.getByRole('button', {name: 'One less KF-01'})).toBeDisabled();

    await userEvent.click(kf01.getByRole('button', {name: 'One more KF-01'}));
    expect(kf01.getByLabelText('This shipment of KF-01')).toHaveTextContent(
      '1',
    );

    await userEvent.click(kf01.getByRole('button', {name: 'One less KF-01'}));
    expect(kf01.getByLabelText('This shipment of KF-01')).toHaveTextContent(
      '0',
    );
  });

  it('adds a code the camera reads', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    });
    HTMLMediaElement.prototype.play = vi.fn(async () => undefined);
    const frames: string[][] = [];
    const track = {stop: vi.fn(), getCapabilities: () => ({})};
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [track],
          getVideoTracks: () => [track],
        })),
      },
      vibrate: vi.fn(),
    });
    const detector: DetectorFactory = async () => ({
      detect: async () => frames.shift() ?? [],
    });
    renderIt(PARTIALS, vi.fn(), detector);

    await userEvent.click(screen.getByRole('button', {name: 'Start camera'}));
    await screen.findByText('Point the camera at a barcode.');
    frames.push(['KF-01']);
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(
      within(line('KF-01')).getByLabelText('This shipment of KF-01'),
    ).toHaveTextContent('1');
  });

  it('names the count on the ship button, and sends what this shipment holds', async () => {
    const api = fakeApi({
      'POST /orders/7/partials': [200, {...PARTIALS, status: 4}],
    });
    const onSaved = renderIt();
    expect(shipButton(), 'nothing to send yet').toBeDisabled();
    expect(screen.getByText('Scan the products to ship.')).toBeInTheDocument();

    await scan('KF-01');
    expect(shipButton()).toHaveTextContent('Ship 1 product');
    await scan('KF-01');
    await scan('KF-02');
    expect(shipButton()).toHaveTextContent('Ship 3 products');
    await userEvent.click(shipButton());

    expect(api.calls).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/orders/7/partials',
        body: {
          items: [
            {uuid: UUID_1, quantity: 2},
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
    await userEvent.click(shipButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The warehouse does not hold enough of KF-01 (0 available).',
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(shipButton()).toBeEnabled();
  });

  it.each([5, 6])(
    'cannot ship an order that is already sent or delivered (status %i), and says why',
    (status) => {
      renderIt({...PARTIALS, status});

      expect(shipButton()).toBeDisabled();
      expect(
        screen.getByText(
          'This order was already sent: it takes no more shipments.',
        ),
      ).toBeInTheDocument();
    },
  );

  it('says so when the order has no products', () => {
    renderIt({...PARTIALS, products: [], inventory: []});

    expect(screen.getByText('This order has no products.')).toBeInTheDocument();
  });
});

import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import type {DetectorFactory} from '@/shared/lib';
import {fakeApi} from '@/shared/test/fakeApi';
import {ToastProvider} from '@/shared/ui';
import {ScanStock} from './ScanStock';

const WAREHOUSES = [
  {id: 1, name: 'Colombia', urls: []},
  {id: 2, name: 'Usa', urls: []},
];

function product(code: string, title: string) {
  return {id: 1, uuid: `u-${code}`, code, title, stock: []};
}

const KF01 = product('KF-01', 'Front bumper');
const KF02 = product('KF-02', 'Rear spoiler');

function renderScan(detector?: DetectorFactory) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ScanStock warehouses={WAREHOUSES} detector={detector} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const scanBox = () => screen.getByLabelText('Barcode');

async function scan(code: string) {
  await userEvent.type(scanBox(), `${code}{Enter}`);
}

const scanned = () => screen.getByRole('list', {name: 'Scanned'});

/** The running list's row of a code. */
const line = (code: string) =>
  within(scanned())
    .getAllByRole('listitem')
    .find((item) => item.textContent?.includes(code))!;

const lineCodes = () =>
  within(scanned())
    .getAllByRole('listitem')
    .map((item) => item.querySelector('.scan-line__code')?.textContent);

describe('ScanStock', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the warehouse and the mode first, and remembers both for the next visit', async () => {
    fakeApi({});
    const {unmount} = renderScan();

    const warehouse = screen.getByRole('radiogroup', {name: 'Warehouse'});
    const mode = screen.getByRole('radiogroup', {name: 'What the scans do'});
    expect(
      within(warehouse).getByRole('radio', {name: 'Colombia'}),
      'the first warehouse until another is chosen',
    ).toBeChecked();
    expect(within(mode).getByRole('radio', {name: 'Add stock'})).toBeChecked();
    expect(
      warehouse.compareDocumentPosition(scanBox()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      'the warehouse comes before the scanning',
    ).toBeTruthy();

    await userEvent.click(within(warehouse).getByRole('radio', {name: 'Usa'}));
    await userEvent.click(
      within(mode).getByRole('radio', {name: 'Remove stock'}),
    );
    unmount();
    renderScan();

    expect(screen.getByRole('radio', {name: 'Usa'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'Remove stock'})).toBeChecked();
    expect(
      screen.getByRole('button', {name: 'Remove from Usa'}),
    ).toBeInTheDocument();
  });

  it('lists a typed code with the product title once the lookup answers, and keeps the focus in the box', async () => {
    fakeApi({'GET /products/by-code/KF-01': [200, KF01]});
    renderScan();

    await scan('KF-01');

    expect(
      await within(line('KF-01')).findByText('Front bumper'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity of KF-01')).toHaveValue('1');
    expect(scanBox()).toHaveValue('');
    expect(scanBox()).toHaveFocus();
  });

  it('lists a code the camera reads, with its title', async () => {
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
    fakeApi({'GET /products/by-code/KF-02': [200, KF02]});
    renderScan(detector);

    await userEvent.click(screen.getByRole('button', {name: 'Start camera'}));
    await screen.findByText('Point the camera at a barcode.');
    frames.push(['KF-02']);
    await act(() => vi.advanceTimersByTimeAsync(200));

    expect(await screen.findByText('Rear spoiler')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity of KF-02')).toHaveValue('1');
    vi.useRealTimers();
  });

  it('counts the same code again on its row, moves it to the top, and looks it up once', async () => {
    const api = fakeApi({
      'GET /products/by-code/KF-01': [200, KF01],
      'GET /products/by-code/KF-02': [200, KF02],
    });
    renderScan();

    await scan('KF-01');
    await scan('KF-02');
    await scan('KF-01');

    expect(screen.getByLabelText('Quantity of KF-01')).toHaveValue('2');
    expect(lineCodes(), 'the last code read is on top').toEqual([
      'KF-01',
      'KF-02',
    ]);
    expect(
      api.calls.filter((c) => c.path === '/products/by-code/KF-01'),
    ).toHaveLength(1);
    expect(
      await screen.findByText('2 products · 3 units'),
    ).toBeInTheDocument();
  });

  it('undoes the last scan with the button and with Ctrl+Z', async () => {
    fakeApi({
      'GET /products/by-code/KF-01': [200, KF01],
      'GET /products/by-code/KF-02': [200, KF02],
    });
    renderScan();
    const undo = screen.getByRole('button', {name: 'Undo last scan'});
    expect(undo, 'nothing to undo yet').toBeDisabled();

    await scan('KF-01');
    await scan('KF-01');
    await scan('KF-02');
    await userEvent.click(undo);

    expect(
      screen.queryByLabelText('Quantity of KF-02'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Quantity of KF-01')).toHaveValue('2');
    expect(scanBox(), 'the focus goes back to the box').toHaveFocus();

    await userEvent.keyboard('{Control>}z{/Control}');
    expect(screen.getByLabelText('Quantity of KF-01')).toHaveValue('1');
  });

  it('says inline that an unknown code is not a product, and leaves it out without blocking the rest', async () => {
    const api = fakeApi({
      'GET /products/by-code/KF-01': [200, KF01],
      'GET /products/by-code/NOPE': [404, {error: 'product_not_found'}],
      'POST /warehouses/1/stock/add': [204],
    });
    renderScan();

    await scan('KF-01');
    await scan('NOPE');

    expect(
      await within(line('NOPE')).findByText('Not a product'),
    ).toBeInTheDocument();
    await screen.findByText('Front bumper');
    expect(screen.getByText('1 product · 1 unit')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {name: 'Add to Colombia'}),
    );

    await screen.findByRole('status');
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      items: [{code: 'KF-01', quantity: 1}],
    });
  });

  it('adds in one tap, naming the warehouse, then clears the list and returns the focus to the box', async () => {
    const api = fakeApi({
      'GET /products/by-code/KF-01': [200, KF01],
      'POST /warehouses/2/stock/add': [204],
    });
    renderScan();
    await userEvent.click(screen.getByRole('radio', {name: 'Usa'}));
    await scan('KF-01');
    await scan('KF-01');

    await userEvent.click(screen.getByRole('button', {name: 'Add to Usa'}));

    expect(screen.queryByRole('dialog'), 'adding does not ask').toBeNull();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Added 2 units to Usa.',
    );
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      items: [{code: 'KF-01', quantity: 2}],
    });
    expect(
      screen.queryByLabelText('Quantity of KF-01'),
    ).not.toBeInTheDocument();
    expect(scanBox()).toHaveFocus();
  });

  it('asks before removing, naming the warehouse and the units, and sends only once confirmed', async () => {
    const api = fakeApi({
      'GET /products/by-code/KF-01': [200, KF01],
      'POST /warehouses/1/stock/remove': [204],
    });
    renderScan();
    await userEvent.click(screen.getByRole('radio', {name: 'Remove stock'}));
    await scan('KF-01');
    await scan('KF-01');
    await scan('KF-01');

    const remove = screen.getByRole('button', {name: 'Remove from Colombia'});
    expect(remove, 'removing is the destructive one').toHaveClass(
      'kf-btn--danger',
    );
    await userEvent.click(remove);
    const dialog = screen.getByRole('dialog', {name: 'Remove from Colombia?'});
    expect(dialog).toHaveTextContent('3 units of 1 product');
    expect(dialog).toHaveTextContent('Colombia');
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);

    await userEvent.click(
      within(dialog).getByRole('button', {name: 'Remove 3 units'}),
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Removed 3 units from Colombia.',
    );
    expect(api.calls.find((c) => c.method === 'POST')?.path).toBe(
      '/warehouses/1/stock/remove',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(scanBox()).toHaveFocus();
  });

  it('keeps the list and says what is short when the warehouse cannot cover a removal', async () => {
    fakeApi({
      'GET /products/by-code/KF-01': [200, KF01],
      'POST /warehouses/1/stock/remove': [
        422,
        {
          error: 'insufficient_stock',
          message: 'x',
          detail: {code: 'KF-01', available: 3},
        },
      ],
    });
    renderScan();
    await userEvent.click(screen.getByRole('radio', {name: 'Remove stock'}));
    await scan('KF-01');

    await userEvent.click(
      screen.getByRole('button', {name: 'Remove from Colombia'}),
    );
    await userEvent.click(screen.getByRole('button', {name: 'Remove 1 unit'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is not enough stock of KF-01: 3 available.',
    );
    expect(screen.getByLabelText('Quantity of KF-01')).toBeInTheDocument();
    expect(scanBox()).toHaveFocus();
  });

  it('steps a quantity up and down, and refuses one that is not a whole number of 1 or more', async () => {
    fakeApi({'GET /products/by-code/KF-01': [200, KF01]});
    renderScan();
    await scan('KF-01');

    await userEvent.click(screen.getByRole('button', {name: 'One more KF-01'}));
    await userEvent.click(screen.getByRole('button', {name: 'One more KF-01'}));
    await userEvent.click(screen.getByRole('button', {name: 'One less KF-01'}));
    const quantity = screen.getByLabelText('Quantity of KF-01');
    expect(quantity).toHaveValue('2');

    await userEvent.clear(quantity);
    await userEvent.type(quantity, '0');
    expect(
      screen.getByText('Every quantity must be a whole number of 1 or more.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Add to Colombia'}),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole('button', {name: 'Remove KF-01'}));
    expect(screen.getByText(/Nothing scanned yet/)).toBeInTheDocument();
  });

  it('shows what changed once, until it is dismissed', async () => {
    fakeApi({});
    const {unmount} = renderScan();

    expect(screen.getByText(/What changed/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
    expect(screen.queryByText(/What changed/)).toBeNull();
    unmount();
    renderScan();

    expect(screen.queryByText(/What changed/)).toBeNull();
  });
});

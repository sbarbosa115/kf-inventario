import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
import {fakeList} from '@/shared/test/fakeList';
import {InvoicesPage} from './InvoicesPage';

const ME = {
  id: 1,
  username: 'invoices',
  name: 'Invoices',
  roles: ['ROLE_USER', 'ROLE_CAN_READ_INVOICES', 'ROLE_CAN_CREATE_INVOICES'],
};

const ITEM = {
  id: 90,
  description: 'Chair',
  quantity: 2,
  unit_price: '10.00',
  discount: '0.00',
  total: '20.00',
  product: {id: 5, code: 'KF-05'},
};

const invoice = (
  id: number,
  code: string,
  customer: unknown,
  total: string,
) => ({
  id,
  code,
  status: 1,
  customer,
  customer_nit: null,
  customer_address: null,
  comment: null,
  payment_method: null as string | null,
  items: [ITEM],
  subtotal: '20.00',
  tax_rate: '6.00',
  tax_amount: '1.20',
  total,
  created_at: '2026-10-05T10:00:00-05:00',
});

const ANA = {
  id: 7,
  first_name: 'Ana',
  last_name: 'Gomez',
  email: 'ana@kf.test',
  phone: '3001',
};
const INV_2 = {
  ...invoice(2, '20260002', ANA, '21.20'),
  payment_method: 'credit_card',
};
const INV_1 = invoice(1, '20260001', null, '5.00');
const INV_0 = {
  ...invoice(3, '20250003', ANA, '9.00'),
  created_at: '2025-03-01T09:00:00-05:00',
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/invoices']}>
      <SessionProvider>
        <Routes>
          <Route path="/admin/invoices" element={<InvoicesPage />} />
          <Route path="/admin/invoices/new" element={<p>new invoice form</p>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

type Row = ReturnType<typeof invoice>;

/** The invoices list's contract, in memory. */
const invoices = (rows: Row[]) =>
  fakeList(rows, {
    fields: {
      code: (i) => i.code,
      created_at: (i) => i.created_at,
      total: (i) => i.total,
      payment_method: (i) => i.payment_method,
      walk_in: (i) => (i.customer === null ? 'yes' : 'no'),
    },
    search: [
      (i) => i.code,
      (i) => {
        const c = i.customer as typeof ANA | null;
        return c ? `${c.first_name} ${c.last_name}` : '';
      },
      (i) => (i.customer as typeof ANA | null)?.email,
    ],
  });

type Routes = Parameters<typeof fakeApi>[0];
const routes = (extra: Routes = {}): Routes => ({
  'GET /auth/me': [200, ME],
  'GET /invoices': invoices([INV_2, INV_1]),
  ...extra,
});

/** A row's code shows twice (the cell and the card title): the first is the cell's. */
const codeCell = async (code: string) => (await screen.findAllByText(code))[0]!;
const shown = (code: string) => screen.queryAllByText(code).length > 0;
const filterRow = () =>
  within(within(screen.getAllByRole('rowgroup')[0]!).getAllByRole('row')[1]!);
/** A column's filter button in the row under the header. */
const filterButton = (name: string | RegExp) =>
  filterRow().getByRole('button', {name});
const listCalls = (api: ReturnType<typeof fakeApi>) =>
  api.calls.filter((c) => c.path === '/invoices');

describe('InvoicesPage', () => {
  it('lists the invoices with their customer, the total as money and the date, and offers a new one', async () => {
    fakeApi(routes());
    renderPage();

    const row = (await codeCell('20260002')).closest('tr')!;
    expect(within(row).getByText('Ana Gomez')).toBeInTheDocument();
    expect(within(row).getByText('ana@kf.test')).toBeInTheDocument();
    expect(within(row).getByText('$21.20')).toBeInTheDocument();
    expect(within(row).getByText('Oct 5, 2026')).toBeInTheDocument();
    expect(
      await screen.findByRole('link', {name: 'Create invoice'}),
    ).toHaveAttribute('href', '/admin/invoices/new');
    expect(screen.getByText('2 invoices')).toBeInTheDocument();
  });

  it('calls an invoice without a customer a walk-in customer', async () => {
    fakeApi(routes());
    renderPage();

    const row = (await codeCell('20260001')).closest('tr')!;
    expect(within(row).getAllByText('Walk-in customer')[0]).toBeInTheDocument();
  });

  it('keeps Detail and Open PDF in the row menu, the PDF in a new tab', async () => {
    fakeApi(routes());
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Actions for 20260002'}),
    );

    expect(screen.getByRole('menuitem', {name: /Detail/})).toBeInTheDocument();
    const pdf = screen.getByRole('menuitem', {name: /Open PDF/});
    expect(pdf).toHaveAttribute('href', '/api/v1/invoices/2/pdf');
    expect(pdf).toHaveAttribute('target', '_blank');
  });

  it('opens the invoice in a slide-over from the menu, with the lines, the totals as money and the PDF link, and closes it', async () => {
    fakeApi(routes({'GET /invoices/2': [200, INV_2]}));
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Actions for 20260002'}),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: /Detail/}));

    const dialog = await screen.findByRole('dialog', {
      name: 'Invoice 20260002',
    });
    expect(await within(dialog).findByText('KF-05')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Chair').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('$1.20')).toBeInTheDocument();
    expect(within(dialog).getAllByText('$21.20').length).toBeGreaterThan(0);
    expect(
      within(dialog).getByRole('link', {name: 'Open PDF'}),
    ).toHaveAttribute('href', '/api/v1/invoices/2/pdf');

    await userEvent.click(
      within(dialog).getAllByRole('button', {name: 'Close'})[0]!,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the invoice when its row is clicked', async () => {
    fakeApi(routes({'GET /invoices/1': [200, INV_1]}));
    renderPage();

    await userEvent.click((await screen.findAllByText('Walk-in customer'))[0]!);

    expect(
      await screen.findByRole('dialog', {name: 'Invoice 20260001'}),
    ).toBeInTheDocument();
  });

  it('says so when the invoice of the slide-over no longer exists', async () => {
    fakeApi(
      routes({
        'GET /invoices/2': [404, {error: 'invoice_not_found'}],
      }),
    );
    renderPage();

    await userEvent.click(await codeCell('20260002'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invoice no longer exists.',
    );
  });

  it('finds an invoice by its customer, the walk-in customer included', async () => {
    fakeApi(routes());
    renderPage();

    const search = await screen.findByRole('searchbox', {
      name: 'Customer or invoice number',
    });
    await userEvent.type(search, 'gomez');

    await waitFor(() => expect(shown('20260001')).toBe(false));
    expect(shown('20260002')).toBe(true);

    await userEvent.clear(search);
    await userEvent.type(search, 'walk-in');

    await waitFor(() => expect(shown('20260002')).toBe(false));
    expect(shown('20260001')).toBe(true);
  });

  it('keeps the invoices of a date range, and Clear filters brings them all back', async () => {
    fakeApi(routes({'GET /invoices': invoices([INV_2, INV_1, INV_0])}));
    renderPage();
    await codeCell('20250003');

    await userEvent.click(filterButton('Date'));
    fireEvent.change(screen.getByLabelText('From'), {
      target: {value: '2026-01-01'},
    });

    await waitFor(() => expect(shown('20250003')).toBe(false));
    expect(shown('20260002')).toBe(true);

    fireEvent.change(screen.getByLabelText('To'), {
      target: {value: '2026-10-04'},
    });

    expect(
      await screen.findByText('Nothing matches these filters.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));

    await waitFor(() => expect(shown('20250003')).toBe(true));
    expect(shown('20260002')).toBe(true);
  });

  it('says what the section is for when there are no invoices', async () => {
    fakeApi(routes({'GET /invoices': invoices([])}));
    renderPage();

    expect(
      await screen.findByText('There are no invoices yet.'),
    ).toBeInTheDocument();
  });

  it('says so when the person may not see the invoices', async () => {
    fakeApi(
      routes({
        'GET /invoices': [403, {error: 'forbidden', message: 'Forbidden'}],
      }),
    );
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to do this.',
    );
  });

  it('filters under the headers: number and customer as text, the payment from a list, the total as a range, the date', async () => {
    const api = fakeApi(routes());
    renderPage();
    await codeCell('20260001');

    expect(
      filterRow().getByRole('searchbox', {name: 'Filter by Invoice'}),
    ).toBeInTheDocument();
    expect(
      filterRow().getByRole('searchbox', {name: 'Filter by Customer'}),
    ).toBeInTheDocument();
    expect(filterButton('Date')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(
      listCalls(api)[0]?.url.searchParams.get('facets'),
      'the payment methods and walk-in are counted',
    ).toBe('payment_method,walk_in');

    await userEvent.click(filterButton('Payment'));
    const panel = screen.getByRole('dialog', {name: 'Payment'});
    expect(
      within(panel)
        .getAllByRole('checkbox')
        .map((box) => box.closest('label')?.textContent),
    ).toEqual(['Credit - counted0', 'Credit card - Paypal1']);
    await userEvent.click(
      within(panel).getByRole('checkbox', {name: /Credit card/}),
    );
    await waitFor(() => expect(shown('20260001')).toBe(false));
    expect(
      listCalls(api)
        .at(-1)
        ?.url.searchParams.getAll('filter[payment_method][]'),
    ).toEqual(['credit_card']);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Remove the filter Payment: Credit card - Paypal',
      }),
    );
    await waitFor(() => expect(shown('20260001')).toBe(true));

    await userEvent.click(filterButton('Total'));
    await userEvent.type(screen.getByLabelText('Min'), '10{Enter}');
    await waitFor(() => expect(shown('20260001')).toBe(false));
    expect(
      listCalls(api).at(-1)?.url.searchParams.get('filter[total][min]'),
    ).toBe('10');
    expect(
      screen.getByText('Total: From $10.00', {
        selector: '.kf-active-filters__text',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the walk-in invoices from the toolbar list, and says so on a chip', async () => {
    const api = fakeApi(routes());
    renderPage();
    await codeCell('20260002');

    await userEvent.click(screen.getByRole('button', {name: 'Walk-in'}));
    await userEvent.click(
      screen.getByRole('checkbox', {name: /Walk-in customer/}),
    );

    await waitFor(() => expect(shown('20260002')).toBe(false));
    expect(
      listCalls(api).at(-1)?.url.searchParams.getAll('filter[walk_in][]'),
    ).toEqual(['yes']);
    expect(
      screen.getByText('Walk-in: Walk-in customer', {
        selector: '.kf-active-filters__text',
      }),
    ).toBeInTheDocument();
  });
});

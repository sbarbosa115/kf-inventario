import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {fakeApi} from '@/shared/test/fakeApi';
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
  payment_method: null,
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
const INV_2 = invoice(2, '20260002', ANA, '21.20');
const INV_1 = invoice(1, '20260001', null, '5.00');

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

type Routes = Parameters<typeof fakeApi>[0];
const routes = (extra: Routes = {}): Routes => ({
  'GET /auth/me': [200, ME],
  'GET /invoices': [200, [INV_2, INV_1]],
  ...extra,
});

describe('InvoicesPage', () => {
  it('lists the invoices with their customer, total, date and a PDF link, and offers a new one', async () => {
    fakeApi(routes());
    renderPage();

    const row = (await screen.findByText('20260002')).closest('tr')!;
    expect(
      within(row).getByText('Ana Gomez [ana@kf.test]'),
    ).toBeInTheDocument();
    expect(within(row).getByText('21.20')).toBeInTheDocument();
    expect(within(row).getByText('05 Oct 2026')).toBeInTheDocument();
    const pdf = within(row).getByRole('link', {name: /View as PDF/});
    expect(pdf).toHaveAttribute('href', '/api/v1/invoices/2/pdf');
    expect(pdf).toHaveAttribute('target', '_blank');
    expect(
      await screen.findByRole('link', {name: 'Create invoice'}),
    ).toHaveAttribute('href', '/admin/invoices/new');
  });

  it('calls an invoice without a customer a POS Client', async () => {
    fakeApi(routes());
    renderPage();

    const row = (await screen.findByText('20260001')).closest('tr')!;
    expect(within(row).getByText('POS Client')).toBeInTheDocument();
  });

  it('opens the detail in a dialog with the lines, the totals and the PDF link, and closes it', async () => {
    fakeApi(routes({'GET /invoices/2': [200, INV_2]}));
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Invoice Detail: 20260002'}),
    );

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('KF-05')).toBeInTheDocument();
    expect(within(dialog).getByText('Chair')).toBeInTheDocument();
    expect(within(dialog).getByText('1.20')).toBeInTheDocument();
    expect(within(dialog).getByText('21.20')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('link', {name: 'View as PDF'}),
    ).toHaveAttribute('href', '/api/v1/invoices/2/pdf');

    await userEvent.click(
      within(dialog).getAllByRole('button', {name: 'Close'})[0]!,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says so when the invoice of the dialog no longer exists', async () => {
    fakeApi(
      routes({
        'GET /invoices/2': [404, {error: 'invoice_not_found'}],
      }),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Invoice Detail: 20260002'}),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invoice no longer exists.',
    );
  });

  it('finds an invoice by its customer', async () => {
    fakeApi(routes());
    renderPage();

    await userEvent.type(await screen.findByRole('searchbox'), 'gomez');

    expect(screen.getByText('20260002')).toBeInTheDocument();
    expect(screen.queryByText('20260001')).not.toBeInTheDocument();
  });

  it('says what the section is for when there are no invoices', async () => {
    fakeApi(routes({'GET /invoices': [200, []]}));
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
});

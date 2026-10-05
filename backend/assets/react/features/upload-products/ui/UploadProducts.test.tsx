import {fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {vi} from 'vitest';
import {UploadProductsForm} from './UploadProductsForm';

const WAREHOUSES = [
  {id: 1, name: 'Colombia', urls: []},
  {id: 2, name: 'Usa', urls: []},
];

function stubUpload(status: number, body: unknown) {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {status}),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function renderForm() {
  render(
    <MemoryRouter>
      <UploadProductsForm warehouses={WAREHOUSES} />
    </MemoryRouter>,
  );
}

const aSheet = () =>
  new File(['x'.repeat(3000)], 'products.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
const notASheet = () =>
  new File(['notes'], 'notes.txt', {type: 'text/plain'});

const fileBox = () => screen.getByLabelText('Stock sheet');
const upload = () => screen.getByRole('button', {name: 'Upload'});

describe('UploadProductsForm', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows the three steps in order, with the template and every product to download', () => {
    renderForm();

    const steps = within(
      screen.getByRole('list', {name: 'How to upload a stock sheet'}),
    ).getAllByRole('listitem');
    expect(
      steps.map((step) => within(step).getByRole('heading').textContent),
    ).toEqual([
      'Download the template',
      'Fill in the quantities',
      'Choose the warehouse and the file',
    ]);
    expect(
      within(steps[0]!).getByRole('link', {name: 'Download the template'}),
    ).toHaveAttribute('href', '/api/v1/products/template.xls');
    expect(
      within(steps[0]!).getByRole('link', {name: 'Download every product'}),
    ).toHaveAttribute('href', '/api/v1/products/template.xls?all=1');
    expect(
      within(steps[2]!).getByRole('radiogroup', {name: 'Warehouse'}),
    ).toBeInTheDocument();
  });

  it('shows the name, size and type of a sheet dropped on the zone', async () => {
    renderForm();

    fireEvent.drop(fileBox().closest('label')!, {
      dataTransfer: {files: [aSheet()]},
    });

    expect(await screen.findByText('products.xlsx')).toBeInTheDocument();
    expect(screen.getByText('3 KB · XLSX')).toBeInTheDocument();
  });

  it('refuses a file that is not an Excel sheet in place, and sends nothing', async () => {
    const fetch = stubUpload(200, {stored: 0});
    renderForm();
    const user = userEvent.setup({applyAccept: false});

    await user.upload(fileBox(), notASheet());

    expect(screen.getByRole('alert')).toHaveTextContent(
      'notes.txt is not an Excel sheet. Choose an .xls or .xlsx file.',
    );
    expect(screen.queryByText('notes.txt')).toBeNull();
    await user.click(upload());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('names what is missing when Upload is pressed without a file', async () => {
    const fetch = stubUpload(200, {stored: 0});
    renderForm();

    await userEvent.click(upload());

    expect(
      screen.getByText('Choose the stock sheet to upload.'),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts the sheet and the warehouse, then sums up the rows stored with a link to that warehouse', async () => {
    const fetch = stubUpload(200, {stored: 48});
    renderForm();

    await userEvent.upload(fileBox(), aSheet());
    await userEvent.click(screen.getByRole('radio', {name: 'Usa'}));
    await userEvent.click(upload());

    const summary = await screen.findByRole('status');
    expect(summary).toHaveTextContent('48 rows stored in Usa');
    expect(
      within(summary).getByRole('link', {name: 'Open the products of Usa'}),
    ).toHaveAttribute('href', '/admin/products?warehouse=2');
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/products/upload');
    expect(init?.method).toBe('POST');
    const body = init?.body as FormData;
    expect((body.get('file') as File).name).toBe('products.xlsx');
    expect(body.get('warehouse_id')).toBe('2');
    expect(
      new Headers(init?.headers).get('Content-Type'),
      'the browser sets the multipart boundary itself',
    ).toBeNull();
    expect(
      screen.queryByText('products.xlsx'),
      'the form is ready for the next sheet',
    ).toBeNull();
  });

  it('says so when the server refuses the file', async () => {
    stubUpload(415, {error: 'unsupported_media', message: 'x'});
    renderForm();

    await userEvent.upload(fileBox(), aSheet());
    await userEvent.click(upload());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The file is not an Excel spreadsheet (xls or xlsx).',
    );
  });

  it('says so when the spreadsheet cannot be read', async () => {
    stubUpload(422, {error: 'invalid_spreadsheet', message: 'x'});
    renderForm();

    await userEvent.upload(fileBox(), aSheet());
    await userEvent.click(upload());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The spreadsheet could not be read. Use the template and try again.',
    );
  });
});

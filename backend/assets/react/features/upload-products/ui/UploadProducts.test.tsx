import {render, screen} from '@testing-library/react';
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
  new File(['x'], 'products.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

describe('UploadProductsForm', () => {
  it('links to the template and to the sheet with every product', () => {
    renderForm();

    expect(
      screen.getByRole('link', {name: /Download template/}),
    ).toHaveAttribute('href', '/api/v1/products/template.xls');
    expect(
      screen.getByRole('link', {name: /Download All Products/}),
    ).toHaveAttribute('href', '/api/v1/products/template.xls?all=1');
  });

  it('posts the file and the warehouse as multipart form data and says how many were stored', async () => {
    const fetch = stubUpload(200, {stored: 3});
    renderForm();

    await userEvent.upload(
      screen.getByLabelText(/Select a xls file/),
      aSheet(),
    );
    await userEvent.selectOptions(screen.getByLabelText('Warehouse'), 'Usa');
    await userEvent.click(screen.getByRole('button', {name: 'Upload'}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      '3 products were stored.',
    );
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/products/upload');
    expect(init?.method).toBe('POST');
    const body = init?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('products.xlsx');
    expect(body.get('warehouse_id')).toBe('2');
    expect(
      new Headers(init?.headers).get('Content-Type'),
      'the browser sets the multipart boundary itself',
    ).toBeNull();
  });

  it('does not send anything without a file or a warehouse', async () => {
    const fetch = stubUpload(200, {stored: 0});
    renderForm();

    await userEvent.click(screen.getByRole('button', {name: 'Upload'}));

    expect(
      screen.getByText('Choose a spreadsheet to upload.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Choose the warehouse the quantities go to.'),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('says so when the file is not a spreadsheet', async () => {
    stubUpload(415, {error: 'unsupported_media', message: 'x'});
    renderForm();

    await userEvent.upload(
      screen.getByLabelText(/Select a xls file/),
      aSheet(),
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Warehouse'),
      'Colombia',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Upload'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The file is not an Excel spreadsheet (xls or xlsx).',
    );
  });

  it('says so when the spreadsheet cannot be read', async () => {
    stubUpload(422, {error: 'invalid_spreadsheet', message: 'x'});
    renderForm();

    await userEvent.upload(
      screen.getByLabelText(/Select a xls file/),
      aSheet(),
    );
    await userEvent.selectOptions(
      screen.getByLabelText('Warehouse'),
      'Colombia',
    );
    await userEvent.click(screen.getByRole('button', {name: 'Upload'}));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The spreadsheet could not be read. Use the template and try again.',
    );
  });
});

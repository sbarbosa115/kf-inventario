import {act, render, screen} from '@testing-library/react';
import {useEffect} from 'react';
import {MemoryRouter} from 'react-router-dom';
import {
  TOAST_SUCCESS_MS,
  ToastProvider,
  useToast,
  type ToastApi,
} from './Toast';

let toast: ToastApi;
function Grab({onReady}: {onReady: (api: ToastApi) => void}) {
  const api = useToast();
  useEffect(() => onReady(api), [api, onReady]);
  return null;
}

function renderToasts() {
  render(
    <MemoryRouter>
      <ToastProvider>
        <Grab
          onReady={(api) => {
            toast = api;
          }}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces a success politely and removes it after 5 s', () => {
    renderToasts();
    act(() =>
      toast.success('Product saved', {
        action: {label: 'Scan stock', href: '/admin/products/barcode'},
      }),
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Product saved');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('link', {name: 'Scan stock'})).toHaveAttribute(
      'href',
      '/admin/products/barcode',
    );
    act(() => vi.advanceTimersByTime(TOAST_SUCCESS_MS - 1));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps an error until it is dismissed', () => {
    renderToasts();
    act(() => toast.error('The shops could not be reached.'));

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The shops could not be reached.',
    );
    act(() => screen.getByRole('button', {name: 'Dismiss'}).click());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

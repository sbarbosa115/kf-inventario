import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createElement} from 'react';
import {Link, MemoryRouter, Route, Routes} from 'react-router-dom';
import {vi} from 'vitest';
import {fakeApi} from '@/shared/test/fakeApi';
import {
  loadAnalytics,
  resetAnalytics,
  trackPageView,
  useAnalytics,
} from './analytics';

afterEach(() => {
  resetAnalytics();
  document.head.innerHTML = '';
  delete (window as {gtag?: unknown}).gtag;
  delete (window as {dataLayer?: unknown}).dataLayer;
  delete (window as {clarity?: unknown}).clarity;
});

const scripts = () =>
  [...document.head.querySelectorAll('script')].map((s) => s.src);

describe('the analytics loader', () => {
  it('loads nothing while both ids are unset', () => {
    loadAnalytics({ga4_measurement_id: null, clarity_project_id: null});

    expect(scripts()).toEqual([]);
    expect(() => trackPageView('/admin/orders')).not.toThrow();
  });

  it('loads GA4 and Clarity once each, the ids only as URL parameters', () => {
    const ids = {
      ga4_measurement_id: 'G-ABC1234',
      clarity_project_id: 'abcdef12',
    };
    loadAnalytics(ids);
    loadAnalytics(ids);

    expect(scripts()).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-ABC1234',
      'https://www.clarity.ms/tag/abcdef12',
    ]);
  });

  it('refuses an id of the wrong shape', () => {
    loadAnalytics({
      ga4_measurement_id: 'G-1"><script>',
      clarity_project_id: 'x y',
    });

    expect(scripts()).toEqual([]);
  });

  it('sends a page view on navigation once GA4 is loaded, without a user id', () => {
    loadAnalytics({ga4_measurement_id: 'G-ABC1234', clarity_project_id: null});
    const gtag = vi.fn();
    (window as unknown as {gtag: typeof gtag}).gtag = gtag;

    trackPageView('/admin/orders?page=2');

    expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_path: '/admin/orders?page=2',
    });
    expect(JSON.stringify(gtag.mock.calls)).not.toMatch(/user_id/);
  });
});

describe('useAnalytics, as the signed-in shell mounts it', () => {
  const IDS = {ga4_measurement_id: 'G-ABC1234', clarity_project_id: 'abcdef12'};

  function Shell() {
    useAnalytics();
    return createElement(
      'nav',
      null,
      createElement(Link, {to: '/admin/orders'}, 'Orders'),
      createElement(Link, {to: '/admin/products'}, 'Products'),
    );
  }

  const app = (start: string) =>
    createElement(
      MemoryRouter,
      {initialEntries: [start]},
      createElement(
        Routes,
        null,
        createElement(Route, {
          path: '/admin/login',
          element: createElement('main', null, 'Sign in'),
        }),
        createElement(Route, {path: '/admin/*', element: createElement(Shell)}),
      ),
    );

  it('loads each tool once and sends a page view on every navigation', async () => {
    const api = fakeApi({'GET /settings/public': [200, IDS]});
    render(app('/admin/products'));
    await waitFor(() => expect(scripts()).toHaveLength(2));
    const gtag = vi.fn();
    (window as unknown as {gtag: typeof gtag}).gtag = gtag;

    await userEvent.click(screen.getByRole('link', {name: 'Orders'}));
    await userEvent.click(screen.getByRole('link', {name: 'Products'}));

    await waitFor(() =>
      expect(gtag.mock.calls.map((call) => call[2])).toEqual([
        {page_path: '/admin/orders'},
        {page_path: '/admin/products'},
      ]),
    );
    expect(scripts()).toEqual([
      'https://www.googletagmanager.com/gtag/js?id=G-ABC1234',
      'https://www.clarity.ms/tag/abcdef12',
    ]);
    // The ids are re-read on each navigation (so newly saved ones load), never loaded twice.
    expect(api.calls.length).toBeGreaterThan(1);
  });

  it('never reads the ids nor loads anything on the sign-in page', async () => {
    const api = fakeApi({'GET /settings/public': [200, IDS]});
    render(app('/admin/login'));

    expect(await screen.findByText('Sign in')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
    expect(scripts()).toEqual([]);
  });

  it('ignores a failed read: the page still works', async () => {
    fakeApi({'GET /settings/public': [500, {error: 'boom'}]});
    render(app('/admin/orders'));

    expect(await screen.findByRole('link', {name: 'Orders'})).toBeVisible();
    expect(scripts()).toEqual([]);
  });
});

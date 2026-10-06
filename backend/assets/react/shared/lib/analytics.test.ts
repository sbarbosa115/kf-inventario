import {vi} from 'vitest';
import {loadAnalytics, resetAnalytics, trackPageView} from './analytics';

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
    const ids = {ga4_measurement_id: 'G-ABC1234', clarity_project_id: 'abcdef12'};
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

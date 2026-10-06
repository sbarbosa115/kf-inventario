import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {apiGet, type Schema} from '@/shared/api';

/** The analytics IDs Settings › Analytics saved (GET /settings/public). */
export type AnalyticsIds = Schema<'PublicSettingsOutput'>;

// The same shapes the API checks on save (Settings\Application\Query\AnalyticsSettings): an ID only ever goes into a
// script URL or a function argument, never into HTML.
const GA4 = /^G-[A-Z0-9]{4,12}$/;
const CLARITY = /^[a-z0-9]{6,20}$/;

interface AnalyticsWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  clarity?: ((...args: unknown[]) => void) & {q?: unknown[]};
}

const loaded = {ga4: null as string | null, clarity: null as string | null};

function addScript(src: string) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/**
 * Loads Google Analytics 4 and Microsoft Clarity for the IDs given, once each (docs/pdr/prd-shops-settings.md,
 * Decisions 15): nothing while an ID is unset or of the wrong shape. No user id is ever sent (Open questions, 4).
 */
export function loadAnalytics(ids: AnalyticsIds): void {
  const w = window as unknown as AnalyticsWindow;
  const ga4 = ids.ga4_measurement_id ?? null;
  if (ga4 && GA4.test(ga4) && loaded.ga4 === null) {
    loaded.ga4 = ga4;
    w.dataLayer = w.dataLayer ?? [];
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params -- gtag.js reads the arguments object itself (Google's snippet)
      w.dataLayer!.push(arguments);
    };
    w.gtag('js', new Date());
    // Page views are sent by trackPageView on every route change (a single-page app).
    w.gtag('config', ga4, {send_page_view: false});
    addScript(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`,
    );
  }
  const clarity = ids.clarity_project_id ?? null;
  if (clarity && CLARITY.test(clarity) && loaded.clarity === null) {
    loaded.clarity = clarity;
    const queue: unknown[] = [];
    w.clarity =
      w.clarity ??
      Object.assign((...args: unknown[]) => queue.push(args), {q: queue});
    addScript(`https://www.clarity.ms/tag/${encodeURIComponent(clarity)}`);
  }
}

/** A page view for GA4 (Clarity follows the single-page app's navigation by itself). */
export function trackPageView(path: string): void {
  const w = window as unknown as AnalyticsWindow;
  w.gtag?.('event', 'page_view', {page_path: path});
}

/** Test seam: forgets what was loaded. */
export function resetAnalytics(): void {
  loaded.ga4 = null;
  loaded.clarity = null;
}

/**
 * Mounted once in the signed-in shell (never on the sign-in page): reads the IDs, loads the tools, and sends a page
 * view on every navigation. A no-op while both IDs are unset; a failed read is ignored (analytics never break a page).
 */
export function useAnalytics(): void {
  const {pathname, search} = useLocation();

  useEffect(() => {
    let current = true;
    apiGet<AnalyticsIds>('/settings/public').then(
      (ids) => {
        if (current) loadAnalytics(ids);
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [pathname]);

  useEffect(() => {
    trackPageView(`${pathname}${search}`);
  }, [pathname, search]);
}

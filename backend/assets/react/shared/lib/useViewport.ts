import {useSyncExternalStore} from 'react';

/** Below this width the shell is a drawer and a bottom tab bar (docs/pdr/prd-redesign.md, "Shell"). */
export const DESKTOP_QUERY = '(min-width: 1024px)';

export type Viewport = 'desktop' | 'compact';

function query(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(DESKTOP_QUERY)
    : null;
}

/** "desktop" from 1024 px, "compact" below; follows the window as it resizes. */
export function useViewport(): Viewport {
  return useSyncExternalStore(
    (listener) => {
      const list = query();
      list?.addEventListener?.('change', listener);
      return () => list?.removeEventListener?.('change', listener);
    },
    () => ((query()?.matches ?? true) ? 'desktop' : 'compact'),
  );
}

/** Below this width lists are cards and filters live in a bottom sheet (docs/pdr/prd-shops-settings.md, Decisions 13). */
export const PHONE_QUERY = '(max-width: 599.98px)';

function phoneQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(PHONE_QUERY)
    : null;
}

/** True under 600 px (follows the window): the filter row is not rendered there, the sheet is the UI. */
export function usePhone(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const list = phoneQuery();
      list?.addEventListener?.('change', listener);
      return () => list?.removeEventListener?.('change', listener);
    },
    () => phoneQuery()?.matches ?? false,
  );
}

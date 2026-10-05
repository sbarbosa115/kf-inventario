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

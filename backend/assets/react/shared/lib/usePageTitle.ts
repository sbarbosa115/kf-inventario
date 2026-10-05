import {useEffect, useSyncExternalStore} from 'react';
import {APP_NAME} from '@/shared/config';

let current: string | null = null;
const listeners = new Set<() => void>();

function publish(title: string | null) {
  current = title;
  document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  listeners.forEach((listener) => listener());
}

/** The browser tab's title for this page: "Orders · KF Inventory"; back to "KF Inventory" when it closes. */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    publish(title || null);
    return () => publish(null);
  }, [title]);
}

/** The current page's title (the shell's top bar on phones shows it). */
export function useCurrentPageTitle(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

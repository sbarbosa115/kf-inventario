import {useEffect} from 'react';
import {APP_NAME} from '@/shared/config';

/** The browser tab's title for this page: "Orders · KF Inventory"; back to "KF Inventory" when it closes. */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);
}

import {useEffect} from 'react';
import {BrowserRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {I18nProvider} from '@/shared/i18n';
import {ToastProvider} from '@/shared/ui';
import {AppRoutes, prefetchRoute} from './routes';

export function App() {
  // The page being opened starts loading on mount, in the same tick as the session check (/auth/me).
  useEffect(() => {
    prefetchRoute(window.location.pathname);
  }, []);

  return (
    <I18nProvider>
      <SessionProvider>
        <BrowserRouter>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </BrowserRouter>
      </SessionProvider>
    </I18nProvider>
  );
}

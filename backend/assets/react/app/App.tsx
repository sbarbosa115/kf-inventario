import {BrowserRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {I18nProvider} from '@/shared/i18n';
import {ToastProvider} from '@/shared/ui';
import {AppRoutes} from './routes';

export function App() {
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

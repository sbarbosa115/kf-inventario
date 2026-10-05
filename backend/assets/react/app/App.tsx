import {BrowserRouter} from 'react-router-dom';
import {SessionProvider} from '@/entities/session';
import {I18nProvider} from '@/shared/i18n';
import {AppRoutes} from './routes';

export function App() {
  return (
    <I18nProvider>
      <SessionProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SessionProvider>
    </I18nProvider>
  );
}

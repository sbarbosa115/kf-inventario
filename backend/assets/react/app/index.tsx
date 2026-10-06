// The React app's entry, mounted by templates/spa.html.twig.
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
// Geist and Geist Mono, self-hosted (OFL-1.1): one variable woff2 per script subset, font-display: swap.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
// The design system after Bootstrap and Font Awesome: tokens (both themes), Bootstrap on the tokens, react-select.
import '@/shared/ui/styles/tokens.css';
import '@/shared/ui/styles/bootstrap-overrides.css';
import '@/shared/ui/styles/react-select.css';
import '@/shared/ui/styles/kit.css';
import './styles/global.css';
import {applyTheme, watchSystemTheme} from '@/shared/lib';
import {App} from './App';

// The inline script of spa.html.twig chose the theme before the first paint; from here the app keeps it.
applyTheme();
watchSystemTheme();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

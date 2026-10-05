// The React app's entry, mounted by templates/spa.html.twig.
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
// Geist and Geist Mono, self-hosted (OFL-1.1): one variable woff2 per script subset, font-display: swap.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import {App} from './App';
import './styles/global.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

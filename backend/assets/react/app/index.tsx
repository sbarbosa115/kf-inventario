// The React app's entry, mounted by templates/spa.html.twig. Item 0 step 0.8 builds the shell here.
import {createRoot} from 'react-dom/client';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(null);
}

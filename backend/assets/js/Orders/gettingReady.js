import { createRoot } from 'react-dom/client';
import React from 'react';
import PartialHandler from './GettingReady/PartialHandler';

const container = document.getElementById('getting-ready');
createRoot(container).render(<PartialHandler
  order={JSON.parse(container.dataset.order)}
  partials={JSON.parse(container.dataset.partials)}
  inventory={JSON.parse(container.dataset.inventory)}
/>);

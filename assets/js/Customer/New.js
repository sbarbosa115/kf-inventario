import { createRoot } from 'react-dom/client';
import React from 'react';
import New from './New/New';

const container = document.getElementById('edit-customer');
createRoot(container).render(<New
  customer={JSON.parse(container.dataset.customer)}
  locations={JSON.parse(container.dataset.locations)}
/>);

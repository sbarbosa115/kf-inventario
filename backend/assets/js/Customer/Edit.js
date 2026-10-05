import { createRoot } from 'react-dom/client';
import React from 'react';
import Edit from './Edit/Edit';

const container = document.getElementById('edit-customer');
createRoot(container).render(<Edit
  customer={JSON.parse(container.dataset.customer)}
  locations={JSON.parse(container.dataset.locations)}
/>);

import { createRoot } from 'react-dom/client';
import React from 'react';
import ManageOrder from './New/ManageOrder';

const container = document.getElementById('order-handler');
createRoot(container).render(<ManageOrder
  locations={JSON.parse(container.dataset.locations)}
  warehouses={JSON.parse(container.dataset.warehouses)}
  customers={JSON.parse(container.dataset.customers)}
  order={JSON.parse(container.dataset.order)}
  actionUrl={container.dataset.actionUrl}
/>);

import { createRoot } from 'react-dom/client';
import React from 'react';
import Customers from './Index/Customers';

const container = document.getElementById('index-customer');
createRoot(container).render(<Customers
  customers={JSON.parse(container.dataset.customers)}
  token={container.dataset.token}
  pagination={JSON.parse(container.dataset.pagination)}
/>);

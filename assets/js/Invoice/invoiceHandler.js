import ReactDOM from 'react-dom';
import React from 'react';
import ManageInvoice from './New/ManageInvoice';

const container = document.getElementById('invoice-handler');

const parse = (value) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
};

ReactDOM.render(<ManageInvoice
  locations={parse(container.dataset.locations) || []}
  warehouses={parse(container.dataset.warehouses) || []}
  customers={parse(container.dataset.customers) || []}
  products={parse(container.dataset.products) || []}
  customerOptionsHtml={container.dataset.customerOptionsHtml || ''}
  actionUrl={container.dataset.actionUrl}
/>, container);

import React from 'react';
import ReactDOM from 'react-dom';
import ManageInvoice from './New/ManageInvoice';

const container = document.getElementById('new-invoice');
if (container) {
    const dataset = container.dataset;
    ReactDOM.render(
        <ManageInvoice
            warehouses={dataset.warehouses ? JSON.parse(dataset.warehouses) : []}
            customers={dataset.customers ? JSON.parse(dataset.customers) : []}
            locations={dataset.locations ? JSON.parse(dataset.locations) : []}
            actionUrl={dataset.url}
            suggestedCode={dataset.suggestedCode || ''}
        />,
        container
    );
}

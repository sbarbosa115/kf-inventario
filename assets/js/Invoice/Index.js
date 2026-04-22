import React from 'react';
import ReactDOM from 'react-dom';
import InvoiceList from './components/InvoiceList';
import './New';

const container = document.getElementById('index-invoices');
if (container) {
    ReactDOM.render(<InvoiceList {...(container.dataset)} />, container);
}

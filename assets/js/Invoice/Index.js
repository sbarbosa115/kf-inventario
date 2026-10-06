import React from 'react';
import { createRoot } from 'react-dom/client';
import InvoiceList from './components/InvoiceList';
import './New';

const container = document.getElementById('index-invoices');
if (container) {
    createRoot(container).render(<InvoiceList {...(container.dataset)} />);
}

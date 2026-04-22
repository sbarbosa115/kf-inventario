import ReactDOM from 'react-dom';
import React from 'react';
import Edit from './Edit/Edit';

const container = document.getElementById('edit-customer');
ReactDOM.render(<Edit
  customer={JSON.parse(container.dataset.customer)}
  locations={JSON.parse(container.dataset.locations)}
/>, container);

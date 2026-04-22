import ReactDOM from 'react-dom';
import React from 'react';
import New from './New/New';

const container = document.getElementById('edit-customer');
ReactDOM.render(<New
  customer={JSON.parse(container.dataset.customer)}
  locations={JSON.parse(container.dataset.locations)}
/>, container);

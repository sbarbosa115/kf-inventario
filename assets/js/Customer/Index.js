import ReactDOM from 'react-dom';
import React from 'react';
import Customers from './Index/Customers';

const container = document.getElementById('index-customer');
ReactDOM.render(<Customers
  customers={JSON.parse(container.dataset.customers)}
  token={container.dataset.token}
/>, container);

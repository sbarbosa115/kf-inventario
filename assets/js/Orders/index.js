import ReactDOM from 'react-dom';
import React from 'react';
import Orders from './Index/Orders';

const container = document.getElementById('index-orders');
ReactDOM.render(<Orders {...(container.dataset)} />, container);

import { createRoot } from 'react-dom/client';
import React from 'react';
import Orders from './Index/Orders';

const container = document.getElementById('index-orders');
createRoot(container).render(<Orders {...(container.dataset)} />);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app/index';
import './app/styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

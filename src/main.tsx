import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@joint/react/styles.css';
import './index.css';
import { App } from './App.tsx';
import { ThemeProvider } from './app/theme.tsx';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);

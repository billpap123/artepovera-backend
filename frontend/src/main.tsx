import React from 'react'; // Ensure React is imported
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Ensure your app can find the correct root element for rendering
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("❌ Root element #root not found. Ensure index.html has <div id='root'></div>");
}

const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

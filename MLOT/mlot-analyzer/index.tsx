import React from 'react';
import ReactDOM from 'react-dom/client';
import { DeSoIdentityProvider } from 'react-deso-protocol';
import './services/desoConfig'; // side effect: configure() once, before identity is used
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DeSoIdentityProvider>
      <App />
    </DeSoIdentityProvider>
  </React.StrictMode>
);

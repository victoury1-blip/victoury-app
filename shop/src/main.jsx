import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { memoriserSource } from './lib/source';

// Dès l'arrivée : l'annonce (fbclid, utm…) n'est plus dans l'adresse au moment de commander.
memoriserSource(window.location.search, document.referrer, navigator.userAgent);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

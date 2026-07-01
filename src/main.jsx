import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StatusProvider } from './contexts/StatusContext'
import './index.css'

// On chunk load error (stale SW cache), clear caches and reload once
window.addEventListener('vite:preloadError', async () => {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch {}
  if (!sessionStorage.getItem('_reloaded')) {
    sessionStorage.setItem('_reloaded', '1');
    location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StatusProvider>
        <App />
      </StatusProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

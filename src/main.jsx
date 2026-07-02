import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StatusProvider } from './contexts/StatusContext'
import './index.css'

async function clearCachesAndReload() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch {}
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.update()));
  } catch {}
  location.reload();
}

// On chunk load error (stale SW cache after a deploy), clear caches and reload.
// Guard: at most one auto-reload per 15s to avoid a reload loop.
function autoRecover() {
  const last = Number(sessionStorage.getItem('_reload_ts') || 0);
  if (Date.now() - last > 15000) {
    sessionStorage.setItem('_reload_ts', String(Date.now()));
    clearCachesAndReload();
    return true;
  }
  return false;
}

window.addEventListener('vite:preloadError', (e) => {
  // ne supprimer l'erreur que si on recharge vraiment — sinon la laisser
  // remonter jusqu'à RootErrorBoundary qui affiche le bouton Recharger
  if (autoRecover()) e.preventDefault?.();
});

// Never show a white page: catch render crashes and offer a reload
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    const msg = String(error?.message || '');
    if (/Loading chunk|dynamically imported module|module script failed/i.test(msg)) {
      autoRecover();
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 40 }}>🔄</p>
          <p style={{ fontWeight: 700, color: '#1E3A5F' }}>Une mise à jour est disponible</p>
          <p style={{ fontSize: 13, color: '#6b7280' }}>L'application doit être rechargée</p>
          <button
            onClick={clearCachesAndReload}
            style={{ background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, fontWeight: 700 }}
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <BrowserRouter>
        <StatusProvider>
          <App />
        </StatusProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  </React.StrictMode>,
)

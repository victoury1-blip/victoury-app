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
    // désenregistrer complètement le SW : garantit de sortir d'une boucle
    // "mise à jour" causée par un service worker défectueux
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.unregister()));
  } catch {}
  // Recharger en contournant le cache HTTP du shell (index.html) : un simple
  // reload peut resservir l'ancien index depuis le cache disque et redemander
  // des chunks supprimés -> boucle. Le paramètre horaire force une vraie
  // récupération réseau.
  try {
    const u = new URL(location.href);
    u.searchParams.set('_r', Date.now().toString());
    location.replace(u.toString());
  } catch {
    location.reload();
  }
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
      const msg = String(this.state.error?.message || this.state.error || '');
      const isChunk = /Loading chunk|dynamically imported module|module script failed|Failed to fetch/i.test(msg);
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 40 }}>🔄</p>
          <p style={{ fontWeight: 700, color: '#1E3A5F' }}>{isChunk ? 'Une mise à jour est disponible' : 'Une erreur est survenue'}</p>
          <p style={{ fontSize: 13, color: '#6b7280' }}>L'application doit être rechargée</p>
          {!isChunk && (
            <pre style={{ fontSize: 11, color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 8, maxWidth: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left' }}>{msg.slice(0, 500)}</pre>
          )}
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

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StatusProvider } from './contexts/StatusContext'
import './index.css'

async function clearCachesAndReload() {
  /* `reset` est retiré AVANT de recharger : laissé dans l'adresse, il relance
     la remise à zéro à chaque chargement — une boucle sans fin. */
  try {
    const u = new URL(location.href);
    if (u.searchParams.has('reset')) {
      u.searchParams.delete('reset');
      history.replaceState(null, '', u.toString());
    }
  } catch { /* adresse illisible */ }
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

/* Signes d'un bundle incohérent — deux versions de l'application mélangées
   après un déploiement. « Cannot access 'x' before initialization » en fait
   partie : un fichier attend une constante d'un autre fichier resté à
   l'ancienne version. Absent de cette liste, il s'affichait en écran rouge au
   lieu de déclencher le rechargement qui le répare. */
function isStaleBundleError(msg) {
  // Volontairement étroit : élargir à « is not a function » ferait recharger
  // l'application sur de VRAIS bugs, qui disparaîtraient alors sans être vus.
  return /Loading chunk|dynamically imported module|module script failed|before initialization/i.test(String(msg || ''));
}

/* Sortie de secours utilisable depuis un téléphone : ouvrir l'application avec
   « ?reset=1 » remet tout à zéro. Sans elle, sortir d'un état bloqué demandait
   les outils de développement, indisponibles sur mobile. */
if (new URLSearchParams(location.search).has('reset')) {
  clearCachesAndReload();
}

/* Au chargement qui SUIT une réinitialisation profonde, le service worker
   fraîchement réenregistré est désinstallé une dernière fois : sans cela il
   reprend la main avec la version qui vient de casser. Le drapeau ne vaut que
   pour ce chargement. */
try {
  if (sessionStorage.getItem('_sw_off') === '1') {
    sessionStorage.removeItem('_sw_off');
    navigator.serviceWorker?.getRegistrations?.()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .catch(() => { /* pas de service worker */ });
  }
} catch { /* stockage indisponible */ }

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

/* Une erreur d'évaluation de module survient HORS du rendu React : aucune
   frontière d'erreur ne la voit, et la page reste blanche. */
window.addEventListener('error', (e) => {
  if (isStaleBundleError(e?.message || e?.error?.message)) autoRecover();
});
window.addEventListener('unhandledrejection', (e) => {
  if (isStaleBundleError(e?.reason?.message || e?.reason)) autoRecover();
});

window.addEventListener('vite:preloadError', (e) => {
  // ne supprimer l'erreur que si on recharge vraiment — sinon la laisser
  // remonter jusqu'à RootErrorBoundary qui affiche le bouton Recharger
  if (autoRecover()) e.preventDefault?.();
});

/* Réinitialisation profonde : le service worker est désinstallé ET son
   réenregistrement est bloqué pour ce chargement, sinon il se réinstalle
   immédiatement et resert la version cassée. */
async function hardReset() {
  try { sessionStorage.setItem('_sw_off', '1'); } catch { /* mode privé */ }
  await clearCachesAndReload();
}

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
    if (isStaleBundleError(msg)) autoRecover();
  }
  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error || '');
      // « Failed to fetch » seul vient du RÉSEAU, pas d'une mise à jour :
      // l'annoncer comme telle envoyait chercher un problème inexistant.
      const isChunk = isStaleBundleError(msg);
      const isNetwork = !isChunk && /Failed to fetch|NetworkError|Load failed/i.test(msg);
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 40 }}>🔄</p>
          <p style={{ fontWeight: 700, color: '#1E3A5F' }}>
            {isChunk ? 'Une mise à jour est disponible' : isNetwork ? 'Connexion indisponible' : 'Une erreur est survenue'}
          </p>
          <p style={{ fontSize: 13, color: '#6b7280' }}>L'application doit être rechargée</p>
          {/* Version affichée : sans elle, impossible de savoir depuis un
              téléphone si l'appareil tourne bien sur la dernière mise en ligne. */}
          <p style={{ fontSize: 11, color: '#9ca3af' }}>version {typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '?'}</p>
          {/* Le message est TOUJOURS affiché : le masquer pour les erreurs de
              mise à jour rendait tout diagnostic impossible depuis un téléphone,
              où les outils de développement n'existent pas. */}
          <pre style={{ fontSize: 11, color: isChunk ? '#6b7280' : '#b91c1c', background: isChunk ? '#f3f4f6' : '#fef2f2', padding: 12, borderRadius: 8, maxWidth: 600, whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'left' }}>{msg.slice(0, 500)}</pre>
          <button
            onClick={clearCachesAndReload}
            style={{ background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, fontWeight: 700 }}
          >
            Recharger
          </button>
          {/* Si « Recharger » ne suffit pas — le service worker se réinstalle
              aussitôt et resert la même version cassée — cette sortie le
              désinstalle pour de bon avant de repartir de zéro. */}
          <button
            onClick={hardReset}
            style={{ background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 600 }}
          >
            Réinitialiser complètement
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

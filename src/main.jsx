import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StatusProvider } from './contexts/StatusContext'
import './index.css'
import { RECOVERY_KEY, nextRecoveryStep, isStaleBundleError } from './lib/bundleRecovery'

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

/* Réparation automatique, par paliers.
 *
 * Vider les caches et recharger ne suffit pas toujours : le service worker se
 * réinstalle dans la foulée et ressert la version cassée. La réparation
 * s'arrêtait pourtant là, et laissait l'écran « Une mise à jour est
 * disponible » — dont le bouton refait exactement la tentative qui vient
 * d'échouer. D'où la boucle : reproposer sans fin le remède inopérant.
 *
 * On monte donc d'un cran à chaque échec — d'abord les caches, puis le service
 * worker désinstallé et maintenu à l'écart — et on ne rend la main à
 * l'utilisateur qu'une fois les deux épuisés. */
/* L'application a-t-elle déjà démarré ?
 *
 * Recharger d'autorité n'a de sens qu'AVANT que l'utilisateur ait quelque chose
 * à perdre. Une fois l'application en service, une saisie est en cours : la
 * recharger sans prévenir efface le travail du moment, et c'est précisément ce
 * qui arrivait — un déploiement en pleine journée, un fichier de l'ancienne
 * version réclamé au détour d'une page, et tout repartait à zéro sans un mot.
 *
 * Passé le démarrage, on se contente donc de proposer la mise à jour. */
let appDemarree = false;

function autoRecover() {
  if (appDemarree) {
    // La bannière prend le relais : elle attend d'être cliquée.
    try { window.dispatchEvent(new CustomEvent('app:update-available')); } catch { /* ignore */ }
    return false;
  }
  let attempts = 0, last = 0;
  try {
    attempts = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
    last = Number(sessionStorage.getItem('_reload_ts') || 0);
  } catch { /* stockage indisponible */ }
  const step = nextRecoveryStep(attempts, Date.now() - last);
  if (!step) return false;
  try {
    sessionStorage.setItem(RECOVERY_KEY, String(attempts + 1));
    sessionStorage.setItem('_reload_ts', String(Date.now()));
  } catch { /* stockage indisponible */ }
  if (step === 'hard') { hardReset(); } else { clearCachesAndReload(); }
  return true;
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
          {/* Un seul bouton, et c'est le plus complet. Le précédent se contentait
              de vider les caches : le service worker se réinstallait aussitôt et
              resservait la version cassée, si bien qu'appuyer redonnait le même
              écran. Proposer d'abord le remède inopérant, c'était installer la
              boucle dans laquelle l'utilisateur tournait. */}
          <button
            onClick={hardReset}
            style={{ background: '#1E3A5F', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 32px', fontSize: 15, fontWeight: 700 }}
          >
            Réinitialiser et recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* Un démarrage qui tient rend son plein crédit à la réparation : sans cela, un
   incident réglé consommerait les tentatives du suivant, des semaines plus tard. */
setTimeout(() => {
  appDemarree = true;
  try { sessionStorage.removeItem(RECOVERY_KEY); } catch { /* stockage indisponible */ }
}, 8000);

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

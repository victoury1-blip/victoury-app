/* Le carillon "nouvelle commande" — synthétisé (Web Audio), pas un fichier
   audio à charger : deux notes qui montent, comme le "cha-ching" familier
   des caisses en ligne (WooCommerce, Shopify…), sans dépendre d'un asset
   externe ni de sa licence. */
let ctx;

function contexte() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function note(freq, debut, duree, gain = 0.2) {
  const c = contexte();
  const osc = c.createOscillator();
  const vol = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(0, c.currentTime + debut);
  vol.gain.linearRampToValueAtTime(gain, c.currentTime + debut + 0.02);
  vol.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + debut + duree);
  osc.connect(vol).connect(c.destination);
  osc.start(c.currentTime + debut);
  osc.stop(c.currentTime + debut + duree);
}

// `sonUrl` : un son personnalisé déposé dans /store/reglages (base64 ou
// lien) — sinon le carillon synthétisé ci-dessus.
export function jouerSonCommande(sonUrl) {
  if (sonUrl) {
    try { new Audio(sonUrl).play().catch(() => {}); return; }
    catch { /* lecture impossible : on retombe sur le carillon */ }
  }
  try {
    note(880, 0, 0.18);
    note(1318.5, 0.09, 0.35);
  } catch { /* AudioContext indisponible ou bloqué par le navigateur */ }
}

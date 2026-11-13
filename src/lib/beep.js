/* Un seul AudioContext, réutilisé — sur iPhone (Safari), en créer un NOUVEAU
   à chaque bip (comme le faisait chaque page séparément) le laisse "suspendu"
   silencieusement : Safari n'autorise l'audio qu'après un geste utilisateur,
   et un contexte tout juste créé n'a jamais eu l'occasion d'être débloqué.
   Android/Chrome est plus tolérant, d'où le bip "qui marche sur Android mais
   pas sur iPhone". Un seul contexte, débloqué une fois (resume()) au premier
   geste, puis réutilisé pour tous les bips suivants — la vraie pratique
   recommandée pour Web Audio, pas seulement un contournement iOS. */
let ctx = null;
function contexteAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/* ── Réglages du son de scan (Réglages → Son du scan) ──
   Gardés sur CET appareil seulement : chaque téléphone a son volume, son
   haut-parleur, et la personne qui scanne choisit ce qu'elle entend. */
export const CLE_SON_SCAN = 'victoury_son_scan';
export const SON_SCAN_DEFAUT = {
  actif: true, volume: 80, vibration: true,
  succes: 'classique', erreur: 'grave',
  succesPerso: null, succesPersoNom: null,
  erreurPerso: null, erreurPersoNom: null,
};

export function lireReglagesSon() {
  try { return { ...SON_SCAN_DEFAUT, ...(JSON.parse(localStorage.getItem(CLE_SON_SCAN) || 'null') || {}) }; }
  catch { return { ...SON_SCAN_DEFAUT }; }
}
export function enregistrerReglagesSon(r) {
  localStorage.setItem(CLE_SON_SCAN, JSON.stringify(r)); // peut lever si quota : géré par l'appelant
  tampons.clear();
}

/* Notes : [fréquence, début (s)], durée, forme d'onde, force relative. */
export const SONS_SUCCES = {
  classique: { label: 'Bip classique', notes: [[1200, 0], [800, 0.1]], duree: 0.3 },
  double:    { label: 'Double bip', notes: [[1500, 0], [0, 0.08], [1500, 0.13]], duree: 0.22, type: 'square', force: 0.5 },
  ding:      { label: 'Ding', notes: [[1760, 0]], duree: 0.6, type: 'triangle', force: 1.4 },
  caisse:    { label: 'Caisse (supermarché)', notes: [[2400, 0]], duree: 0.12, type: 'square', force: 0.55 },
  montant:   { label: 'Montant joyeux', notes: [[660, 0], [880, 0.08], [1320, 0.16]], duree: 0.32 },
};
export const SONS_ERREUR = {
  grave:   { label: 'Grave (3 notes)', notes: [[300, 0], [200, 0.15], [150, 0.3]], duree: 0.45, type: 'square', force: 1.2 },
  buzzer:  { label: 'Buzzer', notes: [[120, 0]], duree: 0.5, type: 'sawtooth', force: 1 },
  triple:  { label: 'Triple bip rapide', notes: [[900, 0], [0, 0.07], [900, 0.12], [0, 0.19], [900, 0.24]], duree: 0.32, type: 'square', force: 0.6 },
  descend: { label: 'Descendant', notes: [[700, 0], [350, 0.2]], duree: 0.45, type: 'triangle', force: 1.3 },
};

function tonalite({ notes, duree, type = 'sine', force = 1 }, volume) {
  try {
    const c = contexteAudio();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(c.destination);
    const g = Math.max(0.0011, 0.6 * force * volume);
    notes.forEach(([freq, decalage]) => {
      // fréquence 0 = silence entre deux bips
      gain.gain.setValueAtTime(freq ? g : 0.0001, c.currentTime + decalage);
      if (freq) osc.frequency.setValueAtTime(freq, c.currentTime + decalage);
    });
    gain.gain.setValueAtTime(g, c.currentTime + duree * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duree);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duree);
  } catch { /* audio indisponible (permissions, navigateur…) — jamais bloquant */ }
}

/* Son importé (mp3/wav en data URL) : décodé une fois dans le même contexte,
   ce qui marche aussi sur iPhone une fois le contexte débloqué. */
const tampons = new Map();
async function jouerFichier(dataUrl, volume) {
  const c = contexteAudio();
  let buf = tampons.get(dataUrl);
  if (!buf) {
    const octets = await (await fetch(dataUrl)).arrayBuffer();
    buf = await new Promise((ok, ko) => c.decodeAudioData(octets, ok, ko));
    tampons.set(dataUrl, buf);
  }
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain);
  gain.connect(c.destination);
  src.start();
}

function vibrer(motif) {
  try { navigator.vibrate?.(motif); } catch { /* pas de vibreur (iPhone, ordinateur) */ }
}

function jouer(sorte, r = lireReglagesSon()) {
  const succes = sorte === 'succes';
  if (r.vibration) vibrer(succes ? 60 : [120, 60, 120, 60, 120]);
  if (!r.actif) return;
  const volume = Math.max(0, Math.min(100, Number(r.volume ?? 80))) / 100;
  if (volume === 0) return;
  const choix = succes ? r.succes : r.erreur;
  const perso = succes ? r.succesPerso : r.erreurPerso;
  const preset = (succes ? SONS_SUCCES : SONS_ERREUR)[choix] || (succes ? SONS_SUCCES.classique : SONS_ERREUR.grave);
  if (choix === 'perso' && perso) {
    jouerFichier(perso, volume).catch(() => tonalite(preset, volume));
  } else {
    tonalite(preset, volume);
  }
}

/** Bip de succès (scan reconnu). */
export function jouerBip(reglages) { jouer('succes', reglages); }

/** Bip d'erreur (scan refusé/déjà scanné). */
export function jouerErreur(reglages) { jouer('erreur', reglages); }

/** À appeler dès le premier geste utilisateur disponible (ex. clic sur
 *  "Démarrer le scan") : débloque l'AudioContext sur iPhone avant le premier
 *  vrai bip, pour que celui-ci ne soit jamais le tout premier son émis. */
export function debloquerAudio() {
  try { contexteAudio(); } catch { /* ignore */ }
}

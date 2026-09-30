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

function tonalite({ frequences, duree, gainDepart = 0.5, type = 'sine' }) {
  try {
    const c = contexteAudio();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(c.destination);
    frequences.forEach(([freq, decalage]) => osc.frequency.setValueAtTime(freq, c.currentTime + decalage));
    gain.gain.setValueAtTime(gainDepart, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duree);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duree);
  } catch { /* audio indisponible (permissions, navigateur…) — jamais bloquant */ }
}

/** Bip de succès (scan reconnu) — deux notes descendantes. */
export function jouerBip() {
  tonalite({ frequences: [[1200, 0], [800, 0.1]], duree: 0.3 });
}

/** Bip d'erreur (scan refusé/déjà scanné) — trois notes graves. */
export function jouerErreur() {
  tonalite({ frequences: [[300, 0], [200, 0.15], [150, 0.3]], duree: 0.45, gainDepart: 0.6, type: 'square' });
}

/** À appeler dès le premier geste utilisateur disponible (ex. clic sur
 *  "Démarrer le scan") : débloque l'AudioContext sur iPhone avant le premier
 *  vrai bip, pour que celui-ci ne soit jamais le tout premier son émis. */
export function debloquerAudio() {
  try { contexteAudio(); } catch { /* ignore */ }
}

import { champsManquants } from './commande';
import { detecterSource } from './source';

/* L'envoi transite par un relais serveur plutôt que d'écrire directement dans
 * Supabase depuis le navigateur : c'est le serveur qui connaît l'IP du
 * visiteur, jamais le navigateur — et c'est elle qui permet d'en déduire une
 * ville approximative, affichée dans le tableau des commandes de
 * l'administration (voir api/commande.js).
 *
 * La validation reste ici, avant le réseau : un panier ou des champs
 * incomplets ne doivent jamais partir en requête. */
export async function envoyerCommande(form, lignes, total) {
  const manque = champsManquants(form, lignes);
  if (manque.length) return { ok: false, manque };

  const source = typeof window !== 'undefined' ? detecterSource(window.location.search, document.referrer) : 'Direct';

  try {
    const res = await fetch('/api/commande', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form, lignes, total, source }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.ok) return { ok: false, error: d.error, manque: d.manque };
    return { ok: true, id: d.id };
  } catch {
    return { ok: false, error: 'Envoi impossible. Vérifiez votre connexion.' };
  }
}

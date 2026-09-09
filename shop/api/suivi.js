// Suivi de commande public — "où en est ma commande ?" sans compte client.
//
// La table `orders` n'est lisible par personne avec la clé publique (anon) :
// les règles d'accès la cantonnent au catalogue et à la CRÉATION d'une
// commande (voir commande.js) — jamais à sa lecture, sinon n'importe qui
// devinant un numéro de commande verrait le nom et l'adresse d'un autre
// client. Cette route passe donc par la clé de service (SUPABASE_SERVICE_ROLE_KEY,
// jamais envoyée au navigateur), et n'accepte de renvoyer une commande que
// si le téléphone fourni correspond exactement à celui de la commande — la
// même paire que le client a lui-même saisie à la commande.

import { rateLimited, clientIp } from './_rateLimit.js';
import { normaliserTelephone } from '../src/lib/commande.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Méthode non autorisée' });

  const ip = clientIp(req);
  // Plus strict que la création de commande : une route de lecture par
  // identifiant+téléphone est justement ce qu'un script tenterait de
  // parcourir en boucle pour deviner des commandes valides.
  if (rateLimited(`suivi:${ip}`, 15, 60_000)) {
    return res.status(200).json({ ok: false, error: 'Trop de tentatives. Réessayez dans une minute.' });
  }

  const { id, telephone } = req.body || {};
  const idPropre = String(id || '').trim().toUpperCase();
  const telPropre = normaliserTelephone(telephone);
  if (!idPropre || !telPropre) {
    return res.status(200).json({ ok: false, error: 'Numéro de commande et téléphone requis.' });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: 'Configuration serveur manquante.' });

  const r = await fetch(
    `${url}/rest/v1/orders?select=id,status,products,product,price,date_added,recipient,tracking_number,report_date&id=eq.${encodeURIComponent(idPropre)}&is_deleted=eq.false`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!r.ok) return res.status(200).json({ ok: false, error: 'Recherche impossible. Réessayez.' });
  const [commande] = await r.json();

  // Même message qu'un téléphone qui ne correspond pas : ne jamais laisser
  // deviner si un NUMÉRO DE COMMANDE existe en distinguant les deux cas.
  if (!commande || normaliserTelephone(commande.recipient?.phone) !== telPropre) {
    return res.status(200).json({ ok: false, error: "Aucune commande trouvée avec ce numéro et ce téléphone." });
  }

  // Jamais l'adresse complète ni l'IP/géoloc capturées à la commande —
  // seules la ville (déjà connue du client, il l'a saisie) et les infos de
  // suivi ont leur place dans une réponse publique.
  return res.status(200).json({
    ok: true,
    commande: {
      id: commande.id,
      status: commande.status,
      products: commande.products || (commande.product ? [commande.product] : []),
      price: commande.price,
      dateAdded: commande.date_added,
      ville: commande.recipient?.city || '',
      trackingNumber: commande.tracking_number || null,
      reportDate: commande.report_date || null,
    },
  });
}

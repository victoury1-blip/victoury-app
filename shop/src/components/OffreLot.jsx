import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { chargerProduit, chargerCouleursAvecTailles, chargerCollectionAvecTailles } from '../lib/catalog';
import { paliersEffectifs } from '../lib/remises';
import { prixLot, fmtMontant } from '../lib/pricing';
import { cleLigne } from '../lib/panier';
import { miniature, surErreurMiniature } from '../lib/img';
import { useLang } from '../lib/i18n';

/* À la caisse : « 🎁 جوج ب 448 درهم » quand une remise par quantité est à
 * une pièce près, avec de quoi l'atteindre SANS quitter le formulaire —
 * la même pièce une 2ᵉ fois, ou une autre couleur du même modèle dans la
 * même taille (seulement celles en stock). Disparaît une fois l'offre
 * atteinte : la ligne affiche alors sa réduction comme d'habitude. */
export default function OffreLot({ lignes, remises, onQuantite, onAjouter }) {
  const { lang } = useLang();
  const ar = lang === 'ar';

  // Première ligne dont la collection a une offre pas encore atteinte.
  const cible = (lignes || []).map(l => {
    const paliers = paliersEffectifs(remises, l.collectionId || null);
    if (!paliers.length) return null;
    const qte = lignes.filter(x => (x.collectionId || null) === (l.collectionId || null)).reduce((n, x) => n + (x.qty || 0), 0);
    return qte < paliers[0].rang ? { ligne: l, paliers, manque: paliers[0].rang - qte } : null;
  }).find(Boolean);

  const [couleurs, setCouleurs] = useState([]);
  const slug = cible?.ligne.slug;
  const taille = cible?.ligne.size || '';
  useEffect(() => {
    setCouleurs([]);
    if (!slug || !onAjouter) return;
    let actif = true;
    chargerProduit(slug)
      // Couleurs du même modèle ; à défaut de groupe, les autres articles de
      // la même collection (même offre, même taille en stock).
      .then(async p => {
        let cs = p?.group_id ? await chargerCouleursAvecTailles(p.group_id) : [];
        if (cs.length < 2 && p?.collection_id) cs = await chargerCollectionAvecTailles(p.collection_id);
        return cs;
      })
      .then(cs => {
        if (!actif) return;
        setCouleurs(cs.filter(c => c.slug !== slug && c.sizes?.some(t => t.size === taille && t.stock > 0)).slice(0, 8));
      })
      .catch(() => {});
    return () => { actif = false; };
  }, [slug, taille, onAjouter]);

  if (!cible) return null;
  const { ligne, paliers, manque } = cible;
  const n = paliers[0].rang;
  const { brut, total } = prixLot(ligne.price, paliers, n);
  const stockMeme = Number.isFinite(ligne.stock) ? ligne.stock : null;
  // La même pièce une fois de plus : seulement si le stock le permet (ou si
  // elle est en réservation, où le stock à zéro est attendu).
  const memeDispo = ligne.precommande || stockMeme === null || stockMeme > ligne.qty;

  const ajouterCouleur = (c) => {
    const t = c.sizes.find(x => x.size === taille);
    onAjouter({
      slug: c.slug, name: c.name, price: c.price, size: taille, color: c.color_name,
      image: c.images?.[0]?.url, stock: t?.stock, collectionId: c.collection_id,
    }, { ouvrirTiroir: false });
  };

  return (
    <div className="mt-4 border-2 border-dashed border-red-300 bg-red-50 rounded-lg p-3" dir={ar ? 'rtl' : 'ltr'}>
      <p className="text-sm font-bold text-red-700">
        {ar
          ? <>🎁 خدي {n === 2 ? 'جوج' : `${n} قطع`} ب {fmtMontant(total, lang)} <span className="font-normal line-through opacity-70">بلاصة {fmtMontant(brut, lang)}</span></>
          : <>🎁 {n} pour {fmtMontant(total, lang)} <span className="font-normal line-through opacity-70">au lieu de {fmtMontant(brut, lang)}</span></>}
      </p>
      <p className="text-xs text-red-600 mt-0.5">
        {ar ? `زيدي ${manque > 1 ? `${manque} قطع` : 'قطعة وحدة'} هنا، بلا ما تخرجي من الطلب 👇` : `Ajoutez ${manque} article${manque > 1 ? 's' : ''} ici, sans quitter la commande 👇`}
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {memeDispo && onQuantite && (
          <button type="button" onClick={() => onQuantite(cleLigne(ligne), ligne.qty + 1)}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-md">
            <Plus size={14} /> {ar ? `زيدي نفس القطعة${taille ? ` (${taille})` : ''}` : `La même${taille ? ` (${taille})` : ''}`}
          </button>
        )}
        {couleurs.map(c => (
          <button key={c.id} type="button" onClick={() => ajouterCouleur(c)}
            className="flex items-center gap-1.5 bg-white border border-red-200 hover:border-red-400 text-xs px-2 py-1.5 rounded-md">
            {c.images?.[0]?.url
              ? <img src={miniature(c.images[0].url)} onError={(e) => surErreurMiniature(e, c.images[0].url)} alt="" className="w-7 h-8 object-cover rounded-sm" />
              : <span className="w-4 h-4 rounded-full border" style={{ background: c.color_hex || '#ddd' }} />}
            <span><Plus size={11} className="inline -mt-0.5" /> {c.color_name || c.name}{taille ? ` · ${taille}` : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

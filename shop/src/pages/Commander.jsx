import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { fmtPrix, totalPanier } from '../lib/pricing';
import { cleLigne } from '../lib/panier';
import { champsManquants } from '../lib/commande';
import { envoyerCommande } from '../lib/envoi';
import { verifierPromo } from '../lib/catalog';
import { trackPixel, sha256, telephonePourMeta, envoyerCAPI, idEvenement } from '../lib/pixel';

const champ = 'w-full border-2 border-gray-400 px-3 py-3 text-sm focus:outline-none focus:border-ink transition-colors';

export default function Commander({ lignes, reglages, onRetirer, onVider }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', telephone: '', ville: '', adresse: '' });
  const [promo, setPromo] = useState(null);
  const [code, setCode] = useState('');
  const [codeErreur, setCodeErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [manque, setManque] = useState([]);

  const t = totalPanier(lignes, {
    paliers: reglages?.paliers, promo, livraison: reglages?.livraison, seuilGratuit: reglages?.seuilGratuit,
  });
  const u = (k, v) => { setForm(f => ({ ...f, [k]: v })); setManque(m => m.filter(x => x !== k)); };

  // Une seule fois à l'arrivée sur la page : la publicité doit voir un panier
  // qui entre en commande, pas chaque changement de quantité qui le précède.
  useEffect(() => {
    trackPixel('InitiateCheckout', {
      value: t.total, currency: 'MAD', num_items: t.articles,
      content_ids: lignes.map(l => l.slug), content_type: 'product',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function appliquerCode() {
    setCodeErreur('');
    if (!code.trim()) return;
    const p = await verifierPromo(code, t.sousTotal - t.remiseQuantite);
    if (!p) { setPromo(null); setCodeErreur('Code invalide ou expiré'); return; }
    setPromo(p);
  }

  async function valider() {
    setErreur('');
    const m = champsManquants(form, lignes);
    if (m.length) { setManque(m); return; }
    setEnvoi(true);
    const r = await envoyerCommande(form, lignes, t.total);
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error || 'Envoi impossible. Réessayez.'); return; }
    /* Un même identifiant des deux côtés : le pixel du navigateur (rapide, mais
       bloqué par les bloqueurs de pub) et le relais serveur (toujours reçu)
       envoient le MÊME achat, et Meta déduplique au lieu de le compter deux fois. */
    const eventID = idEvenement(r.id);
    trackPixel('Purchase', { value: t.total, currency: 'MAD', content_ids: lignes.map(l => l.slug), content_type: 'product' }, eventID);
    if (reglages?.pixel?.enabled && reglages?.pixel?.pixelId) {
      // Sans e-mail collecté, le téléphone (haché) reste le seul signal
      // d'identification envoyé à l'API de Conversions.
      sha256(telephonePourMeta(form.telephone))
        .then(ph => envoyerCAPI(reglages.pixel.pixelId, [{
          event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000),
          event_id: eventID, action_source: 'website',
          user_data: { ph: [ph] },
          custom_data: { value: t.total, currency: 'MAD', order_id: r.id },
        }], reglages.pixel.testCode)).catch(() => {});
    }
    onVider();
    navigate(`/merci/${r.id}`);
  }

  if (!lignes.length) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <p className="text-sm text-gray-400">Votre panier est vide.</p>
        <Link to="/" className="inline-block mt-6 border border-ink px-8 py-3 text-[11px] tracking-widest uppercase">
          Retour à la boutique
        </Link>
      </div>
    );
  }

  const enErreur = (k) => manque.includes(k) ? 'border-red-400' : '';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 dir="rtl" lang="ar" className="text-center text-sm text-ink font-medium">
        الرجاء إدخال معلومات التوصيل
      </h1>

      <div className="mt-10 grid lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          {/* Le client marocain lit son marché en arabe : ces quatre champs sont
              ceux qui décident si le colis arrive au bon endroit — mal compris,
              c'est un livreur perdu ou un colis qui revient. */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label dir="rtl" lang="ar" className="block text-sm text-ink font-medium mb-1.5 text-right">الاسم الكامل *</label>
              <input value={form.nom} onChange={e => u('nom', e.target.value)} className={`${champ} ${enErreur('nom')}`} />
            </div>
            <div>
              <label dir="rtl" lang="ar" className="block text-sm text-ink font-medium mb-1.5 text-right">الهاتف *</label>
              <input value={form.telephone} onChange={e => u('telephone', e.target.value)}
                inputMode="tel" placeholder="06 12 34 56 78" className={`${champ} ${enErreur('telephone')}`} />
              {manque.includes('telephone') && (
                <p className="mt-1 text-[11px] text-red-500">Numéro marocain à 10 chiffres</p>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label dir="rtl" lang="ar" className="block text-sm text-ink font-medium mb-1.5 text-right">المدينة *</label>
              <input value={form.ville} onChange={e => u('ville', e.target.value)} className={`${champ} ${enErreur('ville')}`} />
            </div>
            <div>
              <label dir="rtl" lang="ar" className="block text-sm text-ink font-medium mb-1.5 text-right">العنوان *</label>
              <input value={form.adresse} onChange={e => u('adresse', e.target.value)} className={`${champ} ${enErreur('adresse')}`} />
            </div>
          </div>

          <div className="border border-ink px-4 py-3 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-ink" />
            <span dir="rtl" lang="ar" className="text-xs">الدفع عند الاستلام</span>
          </div>
        </div>

        <div className="bg-sand p-5">
          <div className="space-y-4">
            {lignes.map(l => (
              <div key={cleLigne(l)} className="flex gap-3">
                <div className="w-16 h-20 bg-white shrink-0">
                  {l.image && <img src={l.image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{l.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[l.color, l.size, `×${l.qty}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{fmtPrix(l.price * l.qty)}</p>
                  <button onClick={() => onRetirer(cleLigne(l))} className="mt-1 text-gray-300 hover:text-red-500" aria-label="Retirer">
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Sous-total</span><span>{fmtPrix(t.sousTotal)}</span></div>
            {t.remiseQuantite > 0 && (
              <div className="flex justify-between text-green-700"><span>Remise quantité</span><span>−{fmtPrix(t.remiseQuantite)}</span></div>
            )}
            {t.remisePromo > 0 && (
              <div className="flex justify-between text-green-700"><span>Code promo</span><span>−{fmtPrix(t.remisePromo)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Livraison</span>
              <span>{t.livraison > 0 ? fmtPrix(t.livraison) : 'Gratuite'}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 font-medium">
              <span>Total</span><span>{fmtPrix(t.total)}</span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Code promo"
              className="flex-1 border border-gray-200 px-3 py-2.5 text-sm bg-white" />
            <button onClick={appliquerCode} className="px-4 bg-ink text-white text-[11px] tracking-widest uppercase">
              Appliquer
            </button>
          </div>
          {codeErreur && <p className="mt-1 text-[11px] text-red-500">{codeErreur}</p>}

          {erreur && <p className="mt-4 text-xs text-red-600 bg-red-50 p-3">{erreur}</p>}

          <button onClick={valider} disabled={envoi}
            className="mt-5 w-full bg-ink text-white py-4 text-xs tracking-widest uppercase disabled:opacity-60">
            {envoi ? 'Envoi…' : `Valider la commande — ${fmtPrix(t.total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

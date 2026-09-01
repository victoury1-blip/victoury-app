import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { fmtPrix, totalPanier } from '../lib/pricing';
import { cleLigne } from '../lib/panier';
import { champsManquants } from '../lib/commande';
import { envoyerCommande } from '../lib/envoi';
import { verifierPromo } from '../lib/catalog';

const champ = 'w-full border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:border-ink transition-colors';

export default function Commander({ lignes, reglages, onRetirer, onVider }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nom: '', telephone: '', ville: '', adresse: '', email: '' });
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
      <h1 className="text-center text-sm tracking-[0.2em] uppercase text-gray-600">
        Merci de saisir vos coordonnées de livraison
      </h1>

      <div className="mt-10 grid lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-gray-500 mb-1.5">Nom complet *</label>
              <input value={form.nom} onChange={e => u('nom', e.target.value)} className={`${champ} ${enErreur('nom')}`} />
            </div>
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-gray-500 mb-1.5">Téléphone *</label>
              <input value={form.telephone} onChange={e => u('telephone', e.target.value)}
                inputMode="tel" placeholder="06 12 34 56 78" className={`${champ} ${enErreur('telephone')}`} />
              {manque.includes('telephone') && (
                <p className="mt-1 text-[11px] text-red-500">Numéro marocain à 10 chiffres</p>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-gray-500 mb-1.5">Ville *</label>
              <input value={form.ville} onChange={e => u('ville', e.target.value)} className={`${champ} ${enErreur('ville')}`} />
            </div>
            <div>
              <label className="block text-[11px] tracking-widest uppercase text-gray-500 mb-1.5">Adresse *</label>
              <input value={form.adresse} onChange={e => u('adresse', e.target.value)} className={`${champ} ${enErreur('adresse')}`} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] tracking-widest uppercase text-gray-500 mb-1.5">
              E-mail <span className="normal-case tracking-normal text-gray-400">(facultatif)</span>
            </label>
            <input value={form.email} onChange={e => u('email', e.target.value)} type="email" className={champ} />
          </div>

          <div className="border border-ink px-4 py-3 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-ink" />
            <span className="text-xs tracking-widest uppercase">Paiement à la livraison</span>
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

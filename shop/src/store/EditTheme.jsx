import React, { useEffect, useState } from 'react';
import { Upload, Trash2, Plus, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { televerserPhoto } from '../lib/admin';
import { THEME_DEFAUT } from '../lib/catalog';
import { decouperGras } from '../lib/texteEnrichi';

const ONGLETS = ['Header', 'Home Page', 'Footer', 'Collection', 'Produit'];
const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';

/* Un dépôt de fichier, avec sa vignette et un bouton de suppression — le même
   geste pour le logo et le favicon, chacun avec ses propres dimensions
   conseillées. */
function DeposeImage({ titre, aide, url, onChange, className }) {
  const [envoi, setEnvoi] = useState(false);
  async function surFichier(f) {
    if (!f) return;
    setEnvoi(true);
    try { onChange(await televerserPhoto(f)); }
    catch (e) { alert(e.message || 'Envoi impossible'); }
    finally { setEnvoi(false); }
  }
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-medium">{titre}</h2>
      <p className="text-xs text-gray-400 mt-0.5">{aide}</p>
      <div className="mt-4 flex items-center gap-4">
        <div className={`relative bg-sand border border-gray-100 grid place-items-center overflow-hidden ${className}`}>
          {url ? <img src={url} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-gray-300">Aucun</span>}
          {url && (
            <button onClick={() => onChange('')} className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow text-gray-400 hover:text-red-500">
              <Trash2 size={11} />
            </button>
          )}
        </div>
        <label className="px-4 py-2.5 border border-gray-200 text-xs tracking-wide uppercase cursor-pointer flex items-center gap-2">
          <Upload size={13} /> {envoi ? 'Envoi…' : url ? 'Changer' : 'Choisir un fichier'}
          <input type="file" accept="image/*" hidden onChange={e => surFichier(e.target.files?.[0])} />
        </label>
      </div>
    </section>
  );
}

export default function EditTheme() {
  const [onglet, setOnglet] = useState('Header');
  const [t, setT] = useState(THEME_DEFAUT);
  const [enregistrement, setEnregistrement] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'theme').maybeSingle()
      .then(({ data }) => { if (data?.value) setT({ ...THEME_DEFAUT, ...data.value }); });
  }, []);

  const u = (k, v) => setT(x => ({ ...x, [k]: v }));
  const majAnnonce = (i, v) => setT(x => ({ ...x, annonces: x.annonces.map((a, j) => (j === i ? v : a)) }));
  const ajouterAnnonce = () => setT(x => ({ ...x, annonces: [...x.annonces, ''] }));
  const retirerAnnonce = (i) => setT(x => ({ ...x, annonces: x.annonces.filter((_, j) => j !== i) }));

  async function enregistrer() {
    setEnregistrement(true);
    const propre = { ...t, annonces: t.annonces.filter(a => a.trim()), tailleAnnonce: Number(t.tailleAnnonce) || 11 };
    await supabase.from('shop_settings').upsert({ key: 'theme', value: propre, updated_at: new Date().toISOString() });
    setEnregistrement(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Edit Theme</h1>
          <p className="text-xs text-gray-400 mt-0.5">Personnalisez l'apparence de votre boutique</p>
        </div>
        <button onClick={enregistrer} disabled={enregistrement}
          className="flex items-center gap-2 bg-ink text-white px-5 py-2.5 text-xs tracking-widest uppercase disabled:opacity-60">
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      {ok && <p className="mt-2 text-xs text-green-600">Enregistré</p>}

      <div className="mt-5 flex gap-1 border-b border-gray-200">
        {ONGLETS.map(o => (
          <button key={o} onClick={() => setOnglet(o)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
              onglet === o ? 'border-ink text-ink font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {o}
          </button>
        ))}
      </div>

      {onglet !== 'Header' ? (
        <p className="mt-8 text-sm text-gray-400">Bientôt disponible.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {/* Aperçu en direct : chaque champ se répercute immédiatement, sans
              recharger — c'est ce qui évite d'enregistrer à l'aveugle. */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium">Aperçu Header</h2>
              <span className="text-[10px] text-gray-400">En temps réel</span>
            </div>
            {t.annonceActive && t.annonces.filter(Boolean).length > 0 && (
              <div className="text-center py-2 px-4 text-[11px] tracking-wide"
                style={{ background: t.couleurAnnonceFond, color: t.couleurAnnonceTexte, fontSize: `${t.tailleAnnonce}px` }}>
                {decouperGras(t.annonces.find(Boolean)).map((m, j) => (m.gras ? <b key={j}>{m.texte}</b> : <span key={j}>{m.texte}</span>))}
              </div>
            )}
            <div className="flex items-center gap-4 px-4 py-3">
              {t.logoUrl ? <img src={t.logoUrl} alt="" className="h-7 object-contain" /> : <span className="wordmark text-sm">Victoury</span>}
              <span className="ml-auto text-[10px] text-gray-300">search · panier</span>
            </div>
          </section>

          <DeposeImage titre="Logo" aide='Affiché au centre du header. Laissez vide pour afficher le texte "Victoury".'
            url={t.logoUrl} onChange={v => u('logoUrl', v)} className="w-32 h-16" />
          <DeposeImage titre="Favicon" aide="Icône affichée dans l'onglet du navigateur. Carré, 32×32 ou 64×64 conseillé."
            url={t.faviconUrl} onChange={v => u('faviconUrl', v)} className="w-14 h-14" />

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Barre d'annonce</h2>
                <p className="text-xs text-gray-400 mt-0.5">Bandeau affiché en haut de chaque page</p>
              </div>
              <button onClick={() => u('annonceActive', !t.annonceActive)}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${t.annonceActive ? 'bg-blue-600' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${t.annonceActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {t.annonces.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical size={14} className="text-gray-300 shrink-0" />
                  <input value={a} onChange={e => majAnnonce(i, e.target.value)} className={`${champ} flex-1`} />
                  <button onClick={() => retirerAnnonce(i)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button onClick={ajouterAnnonce} className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <Plus size={13} /> Ajouter une barre d'annonce
            </button>
            <p className="mt-2 text-[11px] text-gray-400">
              Entourez un mot de *pour l'afficher en gras*. Ex. : *Livraison offerte* dans tout le Royaume
            </p>

            <div className="mt-5">
              <label className="flex justify-between text-xs text-gray-500 mb-1.5">
                Taille de police <span>{t.tailleAnnonce}px</span>
              </label>
              <input type="range" min={9} max={18} value={t.tailleAnnonce} onChange={e => u('tailleAnnonce', e.target.value)} className="w-full" />
              <div className="flex justify-between text-[10px] text-gray-300"><span>9px</span><span>18px</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Couleur de fond</label>
                <div className="flex gap-2">
                  <input type="color" value={t.couleurAnnonceFond} onChange={e => u('couleurAnnonceFond', e.target.value)} className="w-11 h-10 border border-gray-200" />
                  <input value={t.couleurAnnonceFond} onChange={e => u('couleurAnnonceFond', e.target.value)} className={`${champ} flex-1 font-mono text-xs uppercase`} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Couleur du texte</label>
                <div className="flex gap-2">
                  <input type="color" value={t.couleurAnnonceTexte} onChange={e => u('couleurAnnonceTexte', e.target.value)} className="w-11 h-10 border border-gray-200" />
                  <input value={t.couleurAnnonceTexte} onChange={e => u('couleurAnnonceTexte', e.target.value)} className={`${champ} flex-1 font-mono text-xs uppercase`} />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

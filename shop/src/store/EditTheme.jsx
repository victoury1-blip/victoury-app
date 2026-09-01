import React, { useEffect, useState } from 'react';
import { Upload, Trash2, Plus, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { televerserPhoto } from '../lib/admin';
import { THEME_DEFAUT } from '../lib/catalog';
import { decouperGras } from '../lib/texteEnrichi';

const ONGLETS = ['Header', 'Home Page', 'Footer', 'Collection', 'Produit'];
const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs text-gray-500 mb-1.5';

/* Un dépôt de fichier, avec sa vignette et un bouton de suppression — le même
   geste pour le logo, le favicon et les images du Hero, chacun avec ses
   propres dimensions conseillées. */
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
    <div className="flex items-center gap-4">
      <div className={`relative bg-sand border border-gray-100 grid place-items-center overflow-hidden shrink-0 ${className}`}>
        {url ? <img src={url} alt="" className="max-w-full max-h-full object-cover w-full h-full" /> : <span className="text-[10px] text-gray-300">Aucun</span>}
        {url && (
          <button type="button" onClick={() => onChange('')} className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow text-gray-400 hover:text-red-500">
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <div>
        {titre && <p className="text-xs text-gray-500">{titre}</p>}
        <label className="mt-1 inline-flex px-3 py-2 border border-gray-200 text-xs tracking-wide uppercase cursor-pointer items-center gap-2">
          <Upload size={13} /> {envoi ? 'Envoi…' : url ? 'Changer' : 'Choisir un fichier'}
          <input type="file" accept="image/*" hidden onChange={e => surFichier(e.target.files?.[0])} />
        </label>
        {aide && <p className="mt-1 text-[11px] text-gray-400 max-w-[16rem]">{aide}</p>}
      </div>
    </div>
  );
}

/* Une liste de liens éditable — les mêmes trois listes reviennent pour les
   collections, les réseaux sociaux et les mentions légales du pied de page. */
function ListeDeLiens({ titre, aide, items, onChange, placeholderUrl = '/page' }) {
  const maj = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const ajouter = () => onChange([...items, { label: '', url: '' }]);
  const retirer = (i) => onChange(items.filter((_, j) => j !== i));
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">{titre}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{aide}</p>
        </div>
        <button type="button" onClick={ajouter} className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 uppercase tracking-wide">
          <Plus size={13} /> Ajouter
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={it.label} onChange={e => maj(i, 'label', e.target.value)} placeholder="Libellé" className={`${champ} flex-1`} />
            <input value={it.url} onChange={e => maj(i, 'url', e.target.value)} placeholder={placeholderUrl} className={`${champ} flex-1`} />
            <button type="button" onClick={() => retirer(i)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-300">Aucun lien</p>}
      </div>
    </section>
  );
}

function Bascule({ actif, onChange }) {
  return (
    <button type="button" onClick={onChange}
      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${actif ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function ChampCouleur({ valeur, onChange }) {
  return (
    <div className="flex gap-2">
      <input type="color" value={valeur} onChange={e => onChange(e.target.value)} className="w-11 h-10 border border-gray-200 shrink-0" />
      <input value={valeur} onChange={e => onChange(e.target.value)} className={`${champ} flex-1 font-mono text-xs uppercase`} />
    </div>
  );
}

export default function EditTheme() {
  const [onglet, setOnglet] = useState('Header');
  const [t, setT] = useState(THEME_DEFAUT);
  const [enregistrement, setEnregistrement] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.from('shop_settings').select('value').eq('key', 'theme').maybeSingle()
      .then(({ data }) => { if (data?.value) setT(fusionner(THEME_DEFAUT, data.value)); });
  }, []);

  function fusionner(defaut, sauve) {
    return {
      ...defaut, ...sauve,
      hero: { ...defaut.hero, ...(sauve.hero || {}) },
      texteSousHero: { ...defaut.texteSousHero, ...(sauve.texteSousHero || {}) },
      footer: { ...defaut.footer, ...(sauve.footer || {}) },
    };
  }

  const u = (k, v) => setT(x => ({ ...x, [k]: v }));
  const uHero = (k, v) => setT(x => ({ ...x, hero: { ...x.hero, [k]: v } }));
  const uSousHero = (k, v) => setT(x => ({ ...x, texteSousHero: { ...x.texteSousHero, [k]: v } }));
  const uFooter = (k, v) => setT(x => ({ ...x, footer: { ...x.footer, [k]: v } }));

  const majAnnonce = (i, v) => setT(x => ({ ...x, annonces: x.annonces.map((a, j) => (j === i ? v : a)) }));
  const ajouterAnnonce = () => setT(x => ({ ...x, annonces: [...x.annonces, ''] }));
  const retirerAnnonce = (i) => setT(x => ({ ...x, annonces: x.annonces.filter((_, j) => j !== i) }));

  async function enregistrer() {
    setEnregistrement(true);
    const nettoyer = (l) => (l || []).filter(it => it.label.trim() && it.url.trim());
    const propre = {
      ...t,
      annonces: t.annonces.filter(a => a.trim()),
      tailleAnnonce: Number(t.tailleAnnonce) || 11,
      texteSousHero: { ...t.texteSousHero, taille: Number(t.texteSousHero.taille) || 14 },
      footer: {
        ...t.footer,
        collections: nettoyer(t.footer.collections),
        reseaux: nettoyer(t.footer.reseaux),
        mentions: nettoyer(t.footer.mentions),
      },
    };
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

      <div className="mt-5 flex gap-1 border-b border-gray-200 overflow-x-auto">
        {ONGLETS.map(o => (
          <button key={o} onClick={() => setOnglet(o)}
            className={`shrink-0 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
              onglet === o ? 'border-ink text-ink font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {o}
          </button>
        ))}
      </div>

      {onglet === 'Header' && (
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

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <DeposeImage titre="Logo" aide='Affiché à gauche du header. Laissez vide pour afficher le texte "Victoury".'
              url={t.logoUrl} onChange={v => u('logoUrl', v)} className="w-32 h-16" />
          </section>
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <DeposeImage titre="Favicon" aide="Icône affichée dans l'onglet du navigateur. Carré, 32×32 ou 64×64 conseillé."
              url={t.faviconUrl} onChange={v => u('faviconUrl', v)} className="w-14 h-14" />
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Barre d'annonce</h2>
                <p className="text-xs text-gray-400 mt-0.5">Bandeau affiché en haut de chaque page</p>
              </div>
              <Bascule actif={t.annonceActive} onChange={() => u('annonceActive', !t.annonceActive)} />
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
              <div><label className={label}>Couleur de fond</label><ChampCouleur valeur={t.couleurAnnonceFond} onChange={v => u('couleurAnnonceFond', v)} /></div>
              <div><label className={label}>Couleur du texte</label><ChampCouleur valeur={t.couleurAnnonceTexte} onChange={v => u('couleurAnnonceTexte', v)} /></div>
            </div>
          </section>
        </div>
      )}

      {onglet === 'Home Page' && (
        <div className="mt-6 space-y-5">
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Section Hero</h2>
            <p className="text-xs text-gray-400 mt-0.5">Image plein écran et texte principal</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <DeposeImage titre="Image Desktop" url={t.hero.imageDesktop} onChange={v => uHero('imageDesktop', v)} className="w-full h-28" />
              <DeposeImage titre="Image Mobile" url={t.hero.imageMobile} onChange={v => uHero('imageMobile', v)} className="w-full h-28" />
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div><label className={label}>Titre</label><input value={t.hero.titre} onChange={e => uHero('titre', e.target.value)} className={champ} /></div>
              <div><label className={label}>Sous-titre</label><input value={t.hero.sousTitre} onChange={e => uHero('sousTitre', e.target.value)} className={champ} /></div>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div><label className={label}>Texte bouton</label><input value={t.hero.boutonTexte} onChange={e => uHero('boutonTexte', e.target.value)} className={champ} /></div>
              <div>
                <label className={label}>Lien bouton</label>
                <input value={t.hero.boutonLien} onChange={e => uHero('boutonLien', e.target.value)} placeholder="/product-category/ensemble-sport/" className={champ} />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Texte sous Hero</h2>
            <p className="text-xs text-gray-400 mt-0.5">Phrase éditoriale affichée sous l'image principale</p>
            <textarea value={t.texteSousHero.texte} onChange={e => uSousHero('texte', e.target.value)} rows={2} className={`${champ} mt-3`} />
            <div className="mt-4">
              <label className="flex justify-between text-xs text-gray-500 mb-1.5">
                Taille de police <span>{t.texteSousHero.taille}px</span>
              </label>
              <input type="range" min={9} max={32} value={t.texteSousHero.taille} onChange={e => uSousHero('taille', e.target.value)} className="w-full" />
              <div className="flex justify-between text-[10px] text-gray-300"><span>9px</span><span>32px</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div><label className={label}>Couleur du texte</label><ChampCouleur valeur={t.texteSousHero.couleurTexte} onChange={v => uSousHero('couleurTexte', v)} /></div>
              <div><label className={label}>Couleur du fond</label><ChampCouleur valeur={t.texteSousHero.couleurFond} onChange={v => uSousHero('couleurFond', v)} /></div>
            </div>
          </section>
        </div>
      )}

      {onglet === 'Footer' && (
        <div className="mt-6 space-y-5">
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-medium">Aperçu Footer</h2>
              <span className="text-[10px] text-gray-400">En temps réel</span>
            </div>
            <div className="p-4 grid grid-cols-4 gap-3 text-[11px]" style={{ background: t.footer.couleurFond, color: t.footer.couleurTexte }}>
              <div>
                <span className="wordmark text-xs">Victoury</span>
                <p className="mt-1 opacity-70">{t.footer.description}</p>
              </div>
              {[['Collections', t.footer.collections], ['Suivez-nous', t.footer.reseaux], ['Mentions légales', t.footer.mentions]].map(([titre, items]) => (
                <div key={titre}>
                  <p className="uppercase opacity-50 mb-1">{titre}</p>
                  {items.filter(i => i.label).map((i, j) => <p key={j} className="opacity-80">{i.label}</p>)}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Description</h2>
            <p className="text-xs text-gray-400 mt-0.5">Texte affiché sous le logo dans le footer</p>
            <textarea value={t.footer.description} onChange={e => uFooter('description', e.target.value)} rows={2} className={`${champ} mt-3`} />
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Couleur du footer</h2>
            <p className="text-xs text-gray-400 mt-0.5">Couleurs de fond et de texte du bandeau footer</p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div><label className={label}>Couleur de fond</label><ChampCouleur valeur={t.footer.couleurFond} onChange={v => uFooter('couleurFond', v)} /></div>
              <div><label className={label}>Couleur du texte</label><ChampCouleur valeur={t.footer.couleurTexte} onChange={v => uFooter('couleurTexte', v)} /></div>
            </div>
          </section>

          <ListeDeLiens titre="Collections" aide="Liens de collections affichés dans le footer"
            items={t.footer.collections} onChange={v => uFooter('collections', v)} placeholderUrl="/product-category/ensemble-sport/" />
          <ListeDeLiens titre="Réseaux sociaux" aide='Liens affichés dans la section "Suivez-nous"'
            items={t.footer.reseaux} onChange={v => uFooter('reseaux', v)} placeholderUrl="https://instagram.com/…" />
          <ListeDeLiens titre="Mentions légales" aide='Liens affichés dans la colonne "Mentions légales"'
            items={t.footer.mentions} onChange={v => uFooter('mentions', v)} placeholderUrl="/politique-de-livraison" />
        </div>
      )}

      {onglet === 'Collection' && (
        <div className="mt-6 space-y-5">
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Pages Collection</h2>
            <p className="text-xs text-gray-400 mt-0.5">Paramètres affectant toutes les pages de collection publiques.</p>
            <div className="mt-5 flex items-center justify-between">
              <div>
                <p className="text-sm">Filtre par taille</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Affiche un sélecteur permettant de filtrer les produits par taille. Utile si la collection mélange plusieurs types de tailles ; superflu sinon.
                </p>
              </div>
              <Bascule actif={t.collectionFiltreTaille} onChange={() => u('collectionFiltreTaille', !t.collectionFiltreTaille)} />
            </div>
          </section>
        </div>
      )}

      {onglet === 'Produit' && (
        <div className="mt-6 space-y-5">
          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Page Produit</h2>
            <p className="text-xs text-gray-400 mt-0.5">Paramètres affectant l'expérience sur les fiches produits.</p>
            <div className="mt-5">
              <p className="text-sm mb-2">Affichage des tailles</p>
              <p className="text-xs text-gray-400 mb-3">Grille : idéale pour un choix court (S…XL). Liste : plus lisible pour un choix long (pointures).</p>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                {[['grille', 'Grille'], ['liste', 'Liste']].map(([val, txt]) => (
                  <button key={val} onClick={() => u('produitAffichageTailles', val)}
                    className={`px-4 py-3 border text-sm ${t.produitAffichageTailles === val ? 'border-ink bg-sand font-medium' : 'border-gray-200 text-gray-500'}`}>
                    {txt}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

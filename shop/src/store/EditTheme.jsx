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
    // Empilé (image au-dessus, bouton en dessous) : à côté, sur un petit
    // écran le bouton "Choisir un fichier" se retrouvait poussé hors du
    // cadre visible par une vignette large (w-full) qui prenait toute la
    // largeur de la ligne.
    <div className="space-y-2">
      <div className={`relative bg-sand border border-gray-100 grid place-items-center overflow-hidden ${className}`}>
        {/* object-contain, pas object-cover : un logo large (bien plus
            large que haut) coupé aux bords de cette vignette ne montrait
            qu'un fragment illisible du texte plutôt que le logo entier. */}
        {url ? <img src={url} alt="" className="max-w-full max-h-full object-contain w-full h-full" /> : <span className="text-[10px] text-gray-300">Aucun</span>}
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

  // Rotation séparée pour la version arabe du bandeau — mêmes gestes, sur
  // le tableau `annoncesAr` plutôt que `annonces`.
  const majAnnonceAr = (i, v) => setT(x => ({ ...x, annoncesAr: x.annoncesAr.map((a, j) => (j === i ? v : a)) }));
  const ajouterAnnonceAr = () => setT(x => ({ ...x, annoncesAr: [...x.annoncesAr, ''] }));
  const retirerAnnonceAr = (i) => setT(x => ({ ...x, annoncesAr: x.annoncesAr.filter((_, j) => j !== i) }));

  async function enregistrer() {
    setEnregistrement(true);
    const nettoyer = (l) => (l || []).filter(it => it.label.trim() && it.url.trim());
    const propre = {
      ...t,
      annonces: t.annonces.filter(a => a.trim()),
      annoncesAr: t.annoncesAr.filter(a => a.trim()),
      tailleAnnonce: Number(t.tailleAnnonce) || 11,
      epaisseurAnnonce: t.epaisseurAnnonce || 'normal',
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
                style={{ background: t.couleurAnnonceFond, color: t.couleurAnnonceTexte, fontSize: `${t.tailleAnnonce}px`, fontWeight: t.epaisseurAnnonce || 'normal' }}>
                {decouperGras(t.annonces.find(Boolean)).map((m, j) => (m.gras ? <b key={j}>{m.texte}</b> : <span key={j}>{m.texte}</span>))}
              </div>
            )}
            {/* La position choisie change ici même l'agencement de l'aperçu,
                pas seulement une étiquette : c'est ce qu'on verra sur le site. */}
            <div className={`flex items-center px-4 py-3 ${
              t.logoPosition === 'centre' ? 'justify-center' : t.logoPosition === 'droite' ? 'flex-row-reverse' : ''}`}>
              {t.logoUrl
                ? <img src={t.logoUrl} alt="" className="object-contain" style={{ height: Math.min(t.logoHauteur || 36, 28) }} />
                : <span className="wordmark" style={{ color: t.couleurTexte, fontSize: Math.min((t.logoHauteur || 36) * 0.5, 20) }}>Victoury</span>}
              {t.logoPosition !== 'centre' && <span className={`text-[10px] text-gray-300 ${t.logoPosition === 'droite' ? 'mr-auto' : 'ml-auto'}`}>search · panier</span>}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <DeposeImage titre="Logo" url={t.logoUrl} onChange={v => u('logoUrl', v)} className="w-32 h-16" />
            {/* S'applique aussi au texte "Victoury" (pas seulement à une image
                déposée) : sans logo importé, c'est ce texte qui tient lieu de
                logo — le laisser hors de ce réglage aurait été surprenant. */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm">Taille du logo</p>
                <span className="text-xs text-gray-400">{t.logoHauteur || 36}px</span>
              </div>
              <input type="range" min="20" max="80" value={t.logoHauteur || 36}
                onChange={e => u('logoHauteur', Number(e.target.value))} className="mt-2 w-full max-w-xs" />
            </div>
            <div className="mt-5">
              <p className="text-sm mb-2">Position du logo</p>
              <div className="grid grid-cols-3 gap-3 max-w-sm">
                {[['gauche', 'Gauche'], ['centre', 'Centre'], ['droite', 'Droite']].map(([val, txt]) => (
                  <button key={val} type="button" onClick={() => u('logoPosition', val)}
                    className={`px-3 py-2.5 border text-sm ${t.logoPosition === val ? 'border-ink bg-sand font-medium' : 'border-gray-200 text-gray-500'}`}>
                    {txt}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Couleur du site</h2>
            {/* Une seule teinte, appliquée partout — texte, boutons, bordures
                actives, étiquettes en arabe : la couleur de la marque, pas un
                réglage à répéter élément par élément. */}
            <p className="text-xs text-gray-400 mt-0.5">Texte, boutons et bordures actives, sur tout le site.</p>
            <div className="mt-3 max-w-xs">
              <ChampCouleur valeur={t.couleurTexte} onChange={v => u('couleurTexte', v)} />
            </div>
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

            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600">Version arabe</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Affichée à la place de la version française quand le site est en arabe.</p>
              <div className="mt-3 space-y-2">
                {t.annoncesAr.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <GripVertical size={14} className="text-gray-300 shrink-0" />
                    <input value={a} onChange={e => majAnnonceAr(i, e.target.value)} dir="rtl" className={`${champ} flex-1`} />
                    <button onClick={() => retirerAnnonceAr(i)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <button onClick={ajouterAnnonceAr} className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                <Plus size={13} /> Ajouter une annonce arabe
              </button>
            </div>

            <div className="mt-5">
              <label className="flex justify-between text-xs text-gray-500 mb-1.5">
                Taille de police <span>{t.tailleAnnonce}px</span>
              </label>
              <input type="range" min={9} max={18} value={t.tailleAnnonce} onChange={e => u('tailleAnnonce', e.target.value)} className="w-full" />
              <div className="flex justify-between text-[10px] text-gray-300"><span>9px</span><span>18px</span></div>
            </div>

            <div className="mt-5">
              <label className={label}>Épaisseur du texte</label>
              <select value={t.epaisseurAnnonce || 'normal'} onChange={e => u('epaisseurAnnonce', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="normal">Normal</option>
                <option value="500">Moyen</option>
                <option value="600">Semi-gras</option>
                <option value="700">Gras</option>
              </select>
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
            <p className="mt-2 text-[11px] text-gray-400">
              {t.hero.slides?.length ? "Utilisée seulement si aucune diapositive n'est réglée ci-dessous." : "Photo affichée tant qu'aucune diapositive n'est ajoutée ci-dessous."}
            </p>

            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Diapositives (2-3 photos qui défilent)</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Remplace la photo unique ci-dessus si au moins une est ajoutée.</p>
                </div>
                <button type="button"
                  onClick={() => uHero('slides', [...(t.hero.slides || []), { imageDesktop: '', imageMobile: '' }])}
                  className="flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 uppercase tracking-wide shrink-0">
                  <Plus size={13} /> Ajouter
                </button>
              </div>
              <div className="mt-4 space-y-4">
                {(t.hero.slides || []).map((s, i) => (
                  <div key={i} className="flex items-start gap-4 border border-gray-100 rounded-lg p-3">
                    <span className="text-xs text-gray-300 mt-2">{i + 1}</span>
                    <div className="flex-1 grid sm:grid-cols-2 gap-4">
                      <DeposeImage titre="Desktop" url={s.imageDesktop}
                        onChange={v => uHero('slides', t.hero.slides.map((x, j) => j === i ? { ...x, imageDesktop: v } : x))}
                        className="w-full h-24" />
                      <DeposeImage titre="Mobile" url={s.imageMobile}
                        onChange={v => uHero('slides', t.hero.slides.map((x, j) => j === i ? { ...x, imageMobile: v } : x))}
                        className="w-full h-24" />
                    </div>
                    <button type="button" onClick={() => uHero('slides', t.hero.slides.filter((_, j) => j !== i))}
                      className="mt-2 text-gray-300 hover:text-red-500 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {!t.hero.slides?.length && <p className="text-xs text-gray-300">Aucune diapositive ajoutée.</p>}
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100 grid sm:grid-cols-2 gap-4">
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Réassurance</h2>
                <p className="text-xs text-gray-400 mt-0.5">Les 3 arguments affichés sous le Hero (livraison, contact, paiement)</p>
              </div>
              <Bascule actif={t.reassuranceActive !== false} onChange={() => u('reassuranceActive', t.reassuranceActive === false)} />
            </div>
            <div className="mt-4 space-y-4">
              {t.reassurance.map((r, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3">
                  <label className={label}>Titre {i + 1}</label>
                  <input value={r.titre} onChange={e => u('reassurance', t.reassurance.map((x, j) => j === i ? { ...x, titre: e.target.value } : x))} className={champ} />
                  <label className={`${label} mt-2`}>Texte {i + 1}</label>
                  <textarea value={r.texte} onChange={e => u('reassurance', t.reassurance.map((x, j) => j === i ? { ...x, texte: e.target.value } : x))} rows={2} className={champ} />
                </div>
              ))}
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

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Moyens de paiement</h2>
            <p className="text-xs text-gray-400 mt-0.5">Badges affichés sous la description du footer</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between max-w-xs">
                <span className="text-sm">Paiement à la livraison</span>
                <Bascule actif={t.footer.paiement?.livraison !== false}
                  onChange={() => uFooter('paiement', { ...t.footer.paiement, livraison: t.footer.paiement?.livraison === false })} />
              </div>
              <div className="flex items-center justify-between max-w-xs">
                <span className="text-sm">Virement bancaire</span>
                <Bascule actif={!!t.footer.paiement?.virement}
                  onChange={() => uFooter('paiement', { ...t.footer.paiement, virement: !t.footer.paiement?.virement })} />
              </div>
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium">Contact</h2>
            <p className="text-xs text-gray-400 mt-0.5">Icônes toujours affichées dans le footer ; grisées tant qu'aucun lien n'est réglé ici.</p>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div><label className={label}>WhatsApp (numéro)</label>
                <input value={t.footer.contacts?.whatsapp || ''} onChange={e => uFooter('contacts', { ...t.footer.contacts, whatsapp: e.target.value })} placeholder="0612345678" className={champ} /></div>
              <div><label className={label}>Appel (numéro)</label>
                <input value={t.footer.contacts?.appel || ''} onChange={e => uFooter('contacts', { ...t.footer.contacts, appel: e.target.value })} placeholder="0612345678" className={champ} /></div>
              <div><label className={label}>Instagram (lien)</label>
                <input value={t.footer.contacts?.instagram || ''} onChange={e => uFooter('contacts', { ...t.footer.contacts, instagram: e.target.value })} placeholder="https://instagram.com/…" className={champ} /></div>
              <div><label className={label}>TikTok (lien)</label>
                <input value={t.footer.contacts?.tiktok || ''} onChange={e => uFooter('contacts', { ...t.footer.contacts, tiktok: e.target.value })} placeholder="https://tiktok.com/@…" className={champ} /></div>
              <div><label className={label}>Facebook (lien)</label>
                <input value={t.footer.contacts?.facebook || ''} onChange={e => uFooter('contacts', { ...t.footer.contacts, facebook: e.target.value })} placeholder="https://facebook.com/…" className={champ} /></div>
            </div>
          </section>

          <ListeDeLiens titre="Collections" aide="Liens de collections affichés dans le footer — laissez vide pour reprendre automatiquement les collections du site"
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

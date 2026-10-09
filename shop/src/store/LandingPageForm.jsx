import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, Upload, Plus, Image as ImageIcon } from 'lucide-react';
import { slugifier } from '../lib/slug';
import {
  listerProduits, enregistrerProduit, remplacerTailles, remplacerImages,
  televerserPhoto, televerserVideo,
} from '../lib/admin';
import MediaPicker from './MediaPicker';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs font-medium text-gray-500 mb-1.5';

const VIDE = { name: '', slug: '', price: '', compare_at: '', details: '', description: '', video_url: '' };

// Même brouillon auto-enregistré que ProduitForm.jsx (voir son commentaire) —
// clé distincte pour ne pas écraser un brouillon de produit en cours.
const CLE_BROUILLON = 'victoury_landing_brouillon';
function lireBrouillon() {
  try { return JSON.parse(localStorage.getItem(CLE_BROUILLON) || 'null'); } catch { return null; }
}
function effacerBrouillon() {
  try { localStorage.removeItem(CLE_BROUILLON); } catch { /* quota */ }
}

/* Formulaire DÉDIÉ aux landing pages — volontairement plus simple que
   ProduitForm.jsx (pas de collection, genre, couleur/modèle, tailles ni
   statut) : une landing page n'est pas une fiche de catalogue, c'est un
   visuel déjà composé (souvent exporté de Canva) + un prix + une adresse
   courte. Lui faire remplir des champs de catalogue sans rapport avec son
   usage réel était la plainte explicite qui a mené à cette page séparée.
   Elle écrit dans la même table que les produits (`unlisted: true` forcé,
   sans taille) — LandingVente.jsx et SlugRouter.jsx s'appuient dessus sans
   rien savoir de plus. */
export default function LandingPageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nouveau = id === 'nouveau';
  const brouillon = nouveau ? lireBrouillon() : null;

  const [form, setForm] = useState(brouillon?.form || VIDE);
  const [images, setImages] = useState(brouillon?.images || [{ url: '', alt: '' }]);
  const [bibliotheque, setBibliotheque] = useState(null);
  const [slugModifie, setSlugModifie] = useState(!nouveau || !!brouillon?.form?.slug);
  const [televerse, setTeleverse] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (nouveau) return;
    listerProduits().then(liste => {
      const p = liste.find(x => x.id === id);
      if (!p) return;
      setForm({
        name: p.name, slug: p.slug, price: p.price ?? '', compare_at: p.compare_at ?? '',
        details: p.details || '', description: p.description || '', video_url: p.video_url || '',
      });
      setImages(p.images?.length ? p.images.map(i => ({ url: i.url, alt: i.alt || '' })) : [{ url: '', alt: '' }]);
    }).catch(() => {});
  }, [id, nouveau]);

  useEffect(() => {
    if (!nouveau) return;
    try { localStorage.setItem(CLE_BROUILLON, JSON.stringify({ form, images })); } catch { /* quota */ }
  }, [nouveau, form, images]);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const surNom = (v) => { u('name', v); if (!slugModifie) u('slug', slugifier(v)); };

  const majImage = (i, v) => setImages(im => im.map((x, j) => (j === i ? { ...x, url: v } : x)));
  const ajouterImage = () => setImages(im => [...im, { url: '', alt: '' }]);
  const retirerImage = (i) => setImages(im => im.filter((_, j) => j !== i));

  async function surFichierVideo(fichier) {
    if (!fichier) return;
    setTeleverse(true);
    try { u('video_url', await televerserVideo(fichier)); }
    catch (e) { setErreur(e.message || "Envoi de la vidéo impossible"); }
    finally { setTeleverse(false); }
  }

  async function surFichier(i, fichier) {
    if (!fichier) return;
    setTeleverse(true);
    try { majImage(i, await televerserPhoto(fichier)); }
    catch (e) { setErreur(e.message || 'Envoi de la photo impossible'); }
    finally { setTeleverse(false); }
  }

  async function enregistrer(e) {
    e.preventDefault();
    setErreur('');
    if (!form.name.trim() || !form.slug.trim() || !form.price) {
      setErreur('Nom, adresse et prix sont obligatoires.');
      return;
    }
    setEnregistrement(true);
    try {
      const payload = {
        ...(nouveau ? {} : { id }),
        name: form.name.trim(), slug: slugifier(form.slug),
        price: parseFloat(form.price) || 0, compare_at: form.compare_at ? parseFloat(form.compare_at) : null,
        details: form.details || null, description: form.description || null,
        video_url: form.video_url || null,
        // Forcés : une landing page n'est ni classée dans une collection, ni
        // affichée nulle part sur le site hors de son lien direct.
        status: 'Actif', unlisted: true, gender: 'Unisexe',
        collection_id: null, group_id: null, color_name: null, color_hex: null, is_bestseller: false,
      };
      const p = await enregistrerProduit(payload);
      await remplacerTailles(p.id, []);
      await remplacerImages(p.id, images);
      if (nouveau) effacerBrouillon();
      navigate('/store/landing-pages');
    } catch (e) {
      setErreur(String(e.message || '').includes('duplicate')
        ? "Cette adresse est déjà utilisée par une autre page."
        : (e.message || 'Enregistrement impossible'));
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <form onSubmit={enregistrer} className="max-w-2xl">
      <h1 className="text-lg font-medium">{nouveau ? 'Nouvelle landing page' : 'Modifier la landing page'}</h1>
      <p className="mt-1 text-xs text-gray-400">
        Pensée pour un visuel déjà entièrement composé (ex. export Canva) — ajoutez vos images, le prix,
        et c'est tout. Les champs ci-dessous sous "Texte (optionnel)" ne servent que si votre visuel
        n'inclut pas déjà son propre argumentaire.
      </p>

      <div className="mt-6 space-y-5 bg-white border border-gray-200 rounded-xl p-6">
        <div>
          <label className={label}>Nom *</label>
          <input value={form.name} onChange={e => surNom(e.target.value)} className={champ} placeholder="Ex: Evoke Nova" />
        </div>
        <div>
          <label className={label}>Adresse (slug) *</label>
          <input value={form.slug} onChange={e => { setSlugModifie(true); u('slug', slugifier(e.target.value)); }} className={champ} />
          <p className="mt-1 text-[11px] text-gray-400">victoury-maroc.com/{form.slug || '…'}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Prix (DH) *</label>
            <input value={form.price} onChange={e => u('price', e.target.value)} type="number" min="0" step="0.01" className={champ} />
          </div>
          <div>
            <label className={label}>Prix barré <span className="text-gray-300">(optionnel)</span></label>
            <input value={form.compare_at} onChange={e => u('compare_at', e.target.value)} type="number" min="0" step="0.01" className={champ} />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <label className={label}>Vidéo <span className="text-gray-300">(optionnelle, affichée en premier)</span></label>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-sand shrink-0 grid place-items-center">
              {form.video_url ? <video src={form.video_url} className="w-full h-full object-cover" muted /> : <span className="text-[10px] text-gray-300">Aucune</span>}
            </div>
            <input value={form.video_url} onChange={e => u('video_url', e.target.value)} placeholder="URL de la vidéo" className={`${champ} flex-1`} />
            <label className="px-3 py-2.5 border border-gray-200 text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
              <Upload size={13} /> Choisir
              <input type="file" accept="video/*" hidden onChange={e => surFichierVideo(e.target.files?.[0])} />
            </label>
            {form.video_url && (
              <button type="button" onClick={() => u('video_url', '')} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <label className={label}>Images <span className="text-gray-300">(le visuel de la landing page, dans l'ordre d'affichage)</span></label>
          <div className="space-y-3">
            {images.map((img, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-14 h-14 bg-sand shrink-0">
                  {img.url && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                </div>
                <input value={img.url} onChange={e => majImage(i, e.target.value)} placeholder="URL de l'image" className={`${champ} flex-1`} />
                <label className="px-3 py-2.5 border border-gray-200 text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload size={13} /> Choisir
                  <input type="file" accept="image/*" hidden onChange={e => surFichier(i, e.target.files?.[0])} />
                </label>
                <button type="button" onClick={() => setBibliotheque(i)}
                  className="px-3 py-2.5 border border-gray-200 text-xs flex items-center gap-1.5 shrink-0 hover:bg-gray-50">
                  <ImageIcon size={13} /> Médiathèque
                </button>
                <button type="button" onClick={() => retirerImage(i)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={ajouterImage} className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
            <Plus size={13} /> Ajouter une image
          </button>
          {televerse && <p className="mt-2 text-xs text-gray-400">Envoi…</p>}
        </div>

        <div className="border-t border-gray-100 pt-5">
          <label className={label}>Texte (optionnel) <span className="text-gray-300">— laissez vide si vos images contiennent déjà tout l'argumentaire</span></label>
          <textarea value={form.details} onChange={e => u('details', e.target.value)} rows={4}
            placeholder={'Un argument par ligne, ex:\nBatterie longue durée\nLivraison 24h'} className={champ} />
          <textarea value={form.description} onChange={e => u('description', e.target.value)} rows={2}
            placeholder="Description courte (optionnelle)" className={`${champ} mt-2`} />
        </div>
      </div>

      {bibliotheque !== null && (
        <MediaPicker onFermer={() => setBibliotheque(null)}
          onChoisir={(u) => { majImage(bibliotheque, u); setBibliotheque(null); }} />
      )}

      {erreur && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3">{erreur}</p>}

      <div className="mt-5 flex gap-3">
        <button disabled={enregistrement} className="bg-ink text-white px-6 py-3 text-xs tracking-widest uppercase disabled:opacity-60">
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" onClick={() => navigate('/store/landing-pages')} className="px-6 py-3 text-xs tracking-widest uppercase text-gray-500">
          Annuler
        </button>
      </div>
    </form>
  );
}

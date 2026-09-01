import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, Upload, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { slugifier } from '../lib/slug';
import {
  listerProduits, enregistrerProduit, listerCollections, listerGroupes,
  enregistrerGroupe, remplacerTailles, remplacerImages, televerserPhoto,
} from '../lib/admin';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs font-medium text-gray-500 mb-1.5';

/* Palette prête à l'emploi, comme les pastilles de Volcano : les teintes les
   plus courantes en habillement, pour ne pas ressaisir un code hexadécimal à
   chaque produit. */
const COULEURS_COURANTES = [
  { nom: 'Noir', hex: '#111111' }, { nom: 'Blanc', hex: '#f5f5f5' },
  { nom: 'Gris', hex: '#9ca3af' }, { nom: 'Gris foncé', hex: '#4b5563' },
  { nom: 'Bleu marine', hex: '#1e3a5f' }, { nom: 'Bleu', hex: '#2563eb' },
  { nom: 'Bleu ciel', hex: '#7dd3fc' }, { nom: 'Vert', hex: '#16a34a' },
  { nom: 'Kaki', hex: '#6b7c3f' }, { nom: 'Rouge', hex: '#dc2626' },
  { nom: 'Bordeaux', hex: '#7f1d1d' }, { nom: 'Rose', hex: '#f472b6' },
  { nom: 'Jaune', hex: '#facc15' }, { nom: 'Orange', hex: '#ea580c' },
  { nom: 'Marron', hex: '#78350f' }, { nom: 'Camel', hex: '#c19a6b' },
  { nom: 'Beige', hex: '#e8dcc8' },
];

const VIDE = {
  name: '', slug: '', description: '', details: '', price: '', compare_at: '',
  gender: 'Unisexe', status: 'Actif', collection_id: '', group_id: '',
  color_name: '', color_hex: '#000000',
};

export default function ProduitForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nouveau = id === 'nouveau';

  const [form, setForm] = useState(VIDE);
  const [tailles, setTailles] = useState([{ size: '', stock: '' }]);
  const [images, setImages] = useState([{ url: '', alt: '' }]);
  const [collections, setCollections] = useState([]);
  const [groupes, setGroupes] = useState([]);
  const [nouveauGroupe, setNouveauGroupe] = useState('');
  const [slugModifie, setSlugModifie] = useState(!nouveau);
  const [televerse, setTeleverse] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    listerCollections().then(setCollections).catch(() => {});
    listerGroupes().then(setGroupes).catch(() => {});
    if (nouveau) return;
    listerProduits().then(liste => {
      const p = liste.find(x => x.id === id);
      if (!p) return;
      setForm({
        name: p.name, slug: p.slug, description: p.description || '', details: p.details || '',
        price: p.price ?? '', compare_at: p.compare_at ?? '', gender: p.gender, status: p.status,
        collection_id: p.collection_id || '', group_id: p.group_id || '',
        color_name: p.color_name || '', color_hex: p.color_hex || '#000000',
      });
      setTailles(p.sizes?.length ? p.sizes.map(s => ({ size: s.size, stock: s.stock })) : [{ size: '', stock: '' }]);
      setImages(p.images?.length ? p.images.map(i => ({ url: i.url, alt: i.alt || '' })) : [{ url: '', alt: '' }]);
    }).catch(() => {});
  }, [id, nouveau]);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const surNom = (v) => { u('name', v); if (!slugModifie) u('slug', slugifier(v)); };

  const majTaille = (i, k, v) => setTailles(t => t.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const ajouterTaille = () => setTailles(t => [...t, { size: '', stock: '' }]);
  const retirerTaille = (i) => setTailles(t => t.filter((_, j) => j !== i));

  const majImage = (i, v) => setImages(im => im.map((x, j) => (j === i ? { ...x, url: v } : x)));
  const ajouterImage = () => setImages(im => [...im, { url: '', alt: '' }]);
  const retirerImage = (i) => setImages(im => im.filter((_, j) => j !== i));

  async function surFichier(i, fichier) {
    if (!fichier) return;
    setTeleverse(true);
    try {
      const url = await televerserPhoto(fichier);
      majImage(i, url);
    } catch (e) {
      setErreur(e.message || 'Envoi de la photo impossible');
    } finally {
      setTeleverse(false);
    }
  }

  async function creerGroupe() {
    if (!nouveauGroupe.trim()) return;
    const g = await enregistrerGroupe({ slug: slugifier(nouveauGroupe), name: nouveauGroupe.trim() });
    setGroupes(gs => [...gs, g]);
    u('group_id', g.id);
    setNouveauGroupe('');
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
        description: form.description || null, details: form.details || null,
        price: parseFloat(form.price) || 0, compare_at: form.compare_at ? parseFloat(form.compare_at) : null,
        gender: form.gender, status: form.status,
        collection_id: form.collection_id || null, group_id: form.group_id || null,
        color_name: form.color_name || null, color_hex: form.group_id ? form.color_hex : null,
      };
      const p = await enregistrerProduit(payload);
      await remplacerTailles(p.id, tailles);
      await remplacerImages(p.id, images);
      navigate('/store/produits');
    } catch (e) {
      // Une adresse déjà prise est l'échec le plus probable : le dire clairement.
      setErreur(String(e.message || '').includes('duplicate')
        ? "Cette adresse est déjà utilisée par un autre produit."
        : (e.message || 'Enregistrement impossible'));
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <form onSubmit={enregistrer} className="max-w-3xl">
      <h1 className="text-lg font-medium">{nouveau ? 'Ajouter un produit' : 'Modifier le produit'}</h1>

      <div className="mt-6 space-y-5 bg-white border border-gray-200 rounded-xl p-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Nom *</label>
            <input value={form.name} onChange={e => surNom(e.target.value)} className={champ} />
          </div>
          <div>
            <label className={label}>Adresse (slug) *</label>
            <input value={form.slug} onChange={e => { setSlugModifie(true); u('slug', slugifier(e.target.value)); }} className={champ} />
            <p className="mt-1 text-[11px] text-gray-400">/product/{form.slug || '…'}/</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={label}>Prix (DH) *</label>
            <input value={form.price} onChange={e => u('price', e.target.value)} type="number" min="0" step="0.01" className={champ} />
          </div>
          <div>
            <label className={label}>Prix barré <span className="text-gray-300">(optionnel)</span></label>
            <input value={form.compare_at} onChange={e => u('compare_at', e.target.value)} type="number" min="0" step="0.01" className={champ} />
          </div>
          <div>
            <label className={label}>Statut</label>
            <select value={form.status} onChange={e => u('status', e.target.value)} className={champ}>
              <option>Actif</option><option>Archivé</option><option>Brouillon</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Collection</label>
            <select value={form.collection_id} onChange={e => u('collection_id', e.target.value)} className={champ}>
              <option value="">— Aucune —</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Genre</label>
            <select value={form.gender} onChange={e => u('gender', e.target.value)} className={champ}>
              <option>Unisexe</option><option>Homme</option><option>Femme</option><option>Enfant</option>
            </select>
          </div>
        </div>

        {/* Le groupe relie les couleurs d'un même modèle, pour les pastilles sur
            la fiche : chaque couleur reste un produit à part, photographié et
            vendu séparément. */}
        <div className="border-t border-gray-100 pt-5">
          <label className={label}>Couleur & modèle lié</label>

          {/* Pastilles prêtes à l'emploi, comme sur Volcano : un clic pose le nom
              ET la teinte — plus rapide qu'une saisie manuelle, et le nom reste
              modifiable ensuite pour une teinte qui n'y figure pas. */}
          <div className="flex flex-wrap gap-2">
            {COULEURS_COURANTES.map(c => (
              <button key={c.hex} type="button" title={c.nom}
                onClick={() => { u('color_name', c.nom); u('color_hex', c.hex); }}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  form.color_hex === c.hex ? 'border-ink' : 'border-gray-200'}`}
                style={{ background: c.hex }} />
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <input value={form.color_name} onChange={e => u('color_name', e.target.value)} placeholder="Nom de la couleur (ex. Noir)" className={champ} />
            {/* La couleur native (input type=color) n'affiche qu'un carré, sans
                aucun texte : impossible de relire le code choisi. Celle-ci
                garde le carré ET écrit le code hexadécimal en toutes lettres. */}
            <div className={`${champ} flex items-center gap-2 relative`}>
              <span className="w-6 h-6 rounded border border-gray-200 shrink-0" style={{ background: form.color_hex || '#000000' }} />
              <input value={form.color_hex} onChange={e => u('color_hex', e.target.value)} placeholder="#000000"
                className="flex-1 min-w-0 outline-none uppercase font-mono text-xs tracking-wide" />
              <input value={form.color_hex} onChange={e => u('color_hex', e.target.value)} type="color"
                className="absolute right-1 w-7 h-7 opacity-0 cursor-pointer" title="Choisir sur la palette" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <select value={form.group_id} onChange={e => u('group_id', e.target.value)} className={`${champ} flex-1`}>
              <option value="">— Pas lié à un modèle —</option>
              {groupes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <input value={nouveauGroupe} onChange={e => setNouveauGroupe(e.target.value)} placeholder="Nouveau modèle"
              className={`${champ} w-40`} />
            <button type="button" onClick={creerGroupe} className="px-3 border border-gray-200 text-xs uppercase">Créer</button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <label className={label}>Description</label>
          <textarea value={form.description} onChange={e => u('description', e.target.value)} rows={3} className={champ} />
          <label className={`${label} mt-3`}>Détails <span className="text-gray-300">(matière, entretien…)</span></label>
          <textarea value={form.details} onChange={e => u('details', e.target.value)} rows={3} className={champ} />
        </div>

        {/* Tailles et stock : c'est la taille qui porte le stock, pas le
            produit — une pointure épuisée doit disparaître seule de la fiche. */}
        <div className="border-t border-gray-100 pt-5">
          <label className={label}>Tailles & stock</label>
          <div className="space-y-2">
            {tailles.map((t, i) => {
              // Un stock à zéro ne doit jamais se confondre avec une ligne
              // ordinaire : c'est une taille qu'on ne peut PAS vendre, pas un
              // détail à repérer en plissant les yeux.
              const rupture = t.stock !== '' && Number(t.stock) === 0;
              return (
                <div key={i} className={`flex items-center gap-2 ${rupture ? 'bg-red-50 border border-red-200 rounded-lg px-2 py-1.5' : ''}`}>
                  <input value={t.size} onChange={e => majTaille(i, 'size', e.target.value)} placeholder="Taille (ex. 40)"
                    className={`${champ} w-28 ${rupture ? 'border-red-300' : ''}`} />
                  <input value={t.stock} onChange={e => majTaille(i, 'stock', e.target.value)} type="number" min="0" placeholder="Stock"
                    className={`${champ} w-28 ${rupture ? 'border-red-300 text-red-700 font-medium' : ''}`} />
                  {rupture && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                      <X size={14} strokeWidth={3} /> Rupture de stock
                    </span>
                  )}
                  <button type="button" onClick={() => retirerTaille(i)} className="ml-auto px-2 text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={ajouterTaille} className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
            <Plus size={13} /> Ajouter une taille
          </button>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <label className={label}>Photos</label>
          <div className="space-y-3">
            {images.map((img, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-14 h-14 bg-sand shrink-0">
                  {img.url && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                </div>
                <input value={img.url} onChange={e => majImage(i, e.target.value)} placeholder="URL de la photo" className={`${champ} flex-1`} />
                <label className="px-3 py-2.5 border border-gray-200 text-xs cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload size={13} /> Choisir
                  <input type="file" accept="image/*" hidden onChange={e => surFichier(i, e.target.files?.[0])} />
                </label>
                <button type="button" onClick={() => retirerImage(i)} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={ajouterImage} className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
            <Plus size={13} /> Ajouter une photo
          </button>
          {televerse && <p className="mt-2 text-xs text-gray-400">Envoi de la photo…</p>}
        </div>
      </div>

      {erreur && <p className="mt-4 text-sm text-red-600 bg-red-50 p-3">{erreur}</p>}

      <div className="mt-5 flex gap-3">
        <button disabled={enregistrement} className="bg-ink text-white px-6 py-3 text-xs tracking-widest uppercase disabled:opacity-60">
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button type="button" onClick={() => navigate('/store/produits')} className="px-6 py-3 text-xs tracking-widest uppercase text-gray-500">
          Annuler
        </button>
      </div>
    </form>
  );
}

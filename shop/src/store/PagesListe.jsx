import React, { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { listerPages, enregistrerPage, supprimerPage } from '../lib/admin';
import { slugifier } from '../lib/slug';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';

export default function PagesListe() {
  const [pages, setPages] = useState([]);
  const [edite, setEdite] = useState(null);
  // Le titre français sert à générer le slug (l'adresse de la page) — sans
  // lui il n'y a pas d'URL possible. Une page pensée pour n'exister qu'en
  // arabe garde quand même besoin d'un titre français, même minimal (il ne
  // s'affiche qu'aux visiteurs qui n'ont pas basculé en arabe).
  const [erreur, setErreur] = useState('');

  const recharger = () => listerPages().then(setPages).catch(() => {});
  useEffect(() => { recharger(); }, []);

  async function enregistrer() {
    if (!edite.title.trim()) { setErreur('Le titre (français) est obligatoire — il sert à générer l\'adresse de la page.'); return; }
    setErreur('');
    // Sans ce try/catch, une erreur Supabase (ex. RLS, slug déjà pris) était
    // une exception non attrapée : le formulaire restait ouvert, la liste
    // ne se rafraîchissait jamais, et rien n'indiquait pourquoi — un échec
    // strictement identique, à l'écran, à un clic qui n'aurait rien fait.
    try {
      await enregistrerPage({
        ...(edite.id ? { id: edite.id } : {}),
        slug: edite.slug || slugifier(edite.title),
        title: edite.title.trim(), body: edite.body || '', published: true,
        title_ar: edite.title_ar || '', body_ar: edite.body_ar || '',
      });
      setEdite(null);
      recharger();
    } catch (e) {
      setErreur(e.message || "L'enregistrement a échoué.");
    }
  }

  async function retirer(p) {
    if (!confirm(`Supprimer la page « ${p.title} » ?`)) return;
    await supprimerPage(p.id);
    recharger();
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Pages</h1>
        <button onClick={() => { setEdite({ title: '', slug: '', body: '' }); setErreur(''); }}
          className="flex items-center gap-1.5 bg-ink text-white px-4 py-2.5 text-xs tracking-widest uppercase">
          <Plus size={14} /> Nouvelle page
        </button>
      </div>

      {edite && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <input value={edite.title} onChange={e => setEdite(x => ({ ...x, title: e.target.value }))} placeholder="Titre (français)" className={champ} />
          <textarea value={edite.body} onChange={e => setEdite(x => ({ ...x, body: e.target.value }))} rows={6} placeholder="Contenu (français)" className={champ} />
          {/* Facultatif : une page non traduite retombe simplement sur son
              contenu français quand le client bascule le site en arabe. */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">Traduction arabe (facultative)</p>
            <input value={edite.title_ar || ''} onChange={e => setEdite(x => ({ ...x, title_ar: e.target.value }))}
              placeholder="العنوان (بالعربية)" dir="rtl" className={champ} />
            <textarea value={edite.body_ar || ''} onChange={e => setEdite(x => ({ ...x, body_ar: e.target.value }))}
              rows={6} placeholder="المحتوى (بالعربية)" dir="rtl" className={`mt-3 ${champ}`} />
          </div>
          {erreur && <p className="text-xs text-red-600">{erreur}</p>}
          <div className="flex gap-2">
            <button onClick={enregistrer} className="bg-ink text-white px-4 py-2 text-xs tracking-widest uppercase">Enregistrer</button>
            <button onClick={() => { setEdite(null); setErreur(''); }} className="px-4 py-2 text-xs tracking-widest uppercase text-gray-500">Annuler</button>
          </div>
        </div>
      )}

      <div className="mt-5 bg-white border border-gray-200 rounded-xl divide-y divide-gray-50">
        {pages.map(p => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setEdite(p)} className="text-left">
              <p className="text-sm font-medium">{p.title}</p>
              <p className="text-xs text-gray-400">/{p.slug}/</p>
            </button>
            <button onClick={() => retirer(p)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
        ))}
        {pages.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">Aucune page</p>}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { listerPages, enregistrerPage, supprimerPage } from '../lib/admin';
import { slugifier } from '../lib/slug';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';

export default function PagesListe() {
  const [pages, setPages] = useState([]);
  const [edite, setEdite] = useState(null);

  const recharger = () => listerPages().then(setPages).catch(() => {});
  useEffect(() => { recharger(); }, []);

  async function enregistrer() {
    if (!edite.title.trim()) return;
    await enregistrerPage({
      ...(edite.id ? { id: edite.id } : {}),
      slug: edite.slug || slugifier(edite.title),
      title: edite.title.trim(), body: edite.body || '', published: true,
    });
    setEdite(null);
    recharger();
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
        <button onClick={() => setEdite({ title: '', slug: '', body: '' })}
          className="flex items-center gap-1.5 bg-ink text-white px-4 py-2.5 text-xs tracking-widest uppercase">
          <Plus size={14} /> Nouvelle page
        </button>
      </div>

      {edite && (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <input value={edite.title} onChange={e => setEdite(x => ({ ...x, title: e.target.value }))} placeholder="Titre" className={champ} />
          <textarea value={edite.body} onChange={e => setEdite(x => ({ ...x, body: e.target.value }))} rows={6} placeholder="Contenu" className={champ} />
          <div className="flex gap-2">
            <button onClick={enregistrer} className="bg-ink text-white px-4 py-2 text-xs tracking-widest uppercase">Enregistrer</button>
            <button onClick={() => setEdite(null)} className="px-4 py-2 text-xs tracking-widest uppercase text-gray-500">Annuler</button>
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

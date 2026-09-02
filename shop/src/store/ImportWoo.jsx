import React, { useEffect, useState } from 'react';
import { listerCollections, listerProduits, enregistrerProduit, remplacerImages, remplacerTailles } from '../lib/admin';
import { importerCategorieWoo } from '../lib/wooImport';

const champ = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white';
const label = 'block text-xs text-gray-500 mb-1.5';

/* Import ponctuel : on relance cette page une fois par catégorie à
   récupérer, jamais en tâche de fond — l'admin garde le contrôle de ce
   qui rentre dans le catalogue, produit par produit visible dans le journal. */
export default function ImportWoo() {
  const [collections, setCollections] = useState([]);
  const [collectionId, setCollectionId] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [journal, setJournal] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [resume, setResume] = useState(null);

  useEffect(() => {
    listerCollections().then(cs => {
      setCollections(cs);
      const sport = cs.find(c => c.slug === 'ensemble-sport');
      if (sport) setCollectionId(sport.id);
    }).catch(() => {});
  }, []);

  const log = (m) => setJournal(j => [...j, m]);

  async function importer() {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection || !consumerKey || !consumerSecret) return;
    setEnCours(true);
    setJournal([]);
    setResume(null);
    let importes = 0, echecs = 0;
    try {
      const existants = await listerProduits();
      const parSlug = new Map(existants.map(p => [p.slug, p]));

      const resultats = await importerCategorieWoo({
        categorieSlug: collection.slug, collectionId: collection.id,
        consumerKey, consumerSecret, onProgress: log,
      });

      for (const { produit, images, tailles } of resultats) {
        try {
          const existant = parSlug.get(produit.slug);
          const enregistre = await enregistrerProduit(existant ? { ...produit, id: existant.id } : produit);
          await remplacerImages(enregistre.id, images);
          await remplacerTailles(enregistre.id, tailles);
          importes++;
        } catch (e) {
          echecs++;
          log(`✗ Échec « ${produit.name} » : ${e.message}`);
        }
      }
      setResume({ importes, echecs, total: resultats.length });
    } catch (e) {
      log(`✗ ${e.message}`);
      setResume({ erreur: e.message });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-medium">Importer depuis WooCommerce</h1>
      <p className="text-sm text-gray-500 mt-1">
        Récupère les produits publiés d'une catégorie de l'ancien site (victoury-maroc.com) et les crée ici,
        avec leurs photos, tailles et stock. Relancer sur une catégorie déjà importée met à jour les produits
        existants (même slug) au lieu de les dupliquer.
      </p>

      <section className="mt-6 bg-white border border-gray-200 rounded-xl p-5 max-w-xl space-y-4">
        <div>
          <label className={label}>Collection à remplir</label>
          <select value={collectionId} onChange={e => setCollectionId(e.target.value)} className={champ}>
            <option value="">— Choisir —</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>)}
          </select>
          <p className="mt-1 text-[11px] text-gray-400">
            La catégorie WooCommerce importée est celle qui porte le même slug — vérifiez-le avant de lancer
            l'import sur une collection autre que « ensemble-sport ».
          </p>
        </div>
        <div>
          <label className={label}>Consumer Key WooCommerce</label>
          <input value={consumerKey} onChange={e => setConsumerKey(e.target.value)} className={champ} placeholder="ck_…" />
        </div>
        <div>
          <label className={label}>Consumer Secret WooCommerce</label>
          <input type="password" value={consumerSecret} onChange={e => setConsumerSecret(e.target.value)} className={champ} placeholder="cs_…" />
          <p className="mt-1 text-[11px] text-gray-400">
            WooCommerce → Réglages → Avancé → REST API → Ajouter une clé (permissions « Lecture » suffisent).
            Jamais enregistrées : à ressaisir à chaque import.
          </p>
        </div>
        <button onClick={importer} disabled={enCours || !collectionId || !consumerKey || !consumerSecret}
          className="bg-ink text-white px-5 py-2.5 text-xs tracking-widest uppercase disabled:opacity-40">
          {enCours ? 'Import en cours…' : 'Importer'}
        </button>
      </section>

      {journal.length > 0 && (
        <section className="mt-5 bg-white border border-gray-200 rounded-xl p-5 max-w-xl">
          <h2 className="text-sm font-medium">Journal</h2>
          <div className="mt-3 max-h-72 overflow-y-auto text-xs font-mono space-y-1 text-gray-600">
            {journal.map((m, i) => <p key={i} className={m.startsWith('✗') ? 'text-red-600' : ''}>{m}</p>)}
          </div>
          {resume && (
            <p className={`mt-3 text-sm font-medium ${resume.erreur ? 'text-red-600' : 'text-green-700'}`}>
              {resume.erreur ? resume.erreur : `${resume.importes}/${resume.total} produits importés${resume.echecs ? `, ${resume.echecs} échec(s)` : ''}.`}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

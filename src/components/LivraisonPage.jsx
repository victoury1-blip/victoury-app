import React, { useState, useEffect } from 'react';
import { cloudSet, cloudGet } from '../lib/cloudSettings';
import {
  Plus, Pencil, Trash2, Settings, ChevronLeft,
  CheckCircle2, XCircle, Loader2, DollarSign,
  Eye, EyeOff, Download, Upload, RefreshCw,
} from 'lucide-react';

/* ─── helpers ─── */
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getOzoneConfig() {
  try { return JSON.parse(localStorage.getItem('auzone_config') || '{}'); } catch { return {}; }
}

/* ─── default livreurs ─── */
const DEFAULT_LIVREURS = [
  { id: 1, nom: 'Ozon Express',   telephone: '',           adresse: '',            statut: true, isOzone: true  },
  { id: 2, nom: 'MOHAMED AFKYR',  telephone: '0663372556', adresse: 'CASABLANCA',  statut: true, isOzone: false },
];

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

/* ─── Modals ─── */
function ApiConfigModal({ livreur, onClose, onSave }) {
  const stored = load(`api_config_${livreur.id}`, { cleApi: '', secretApi: '', urlApi: '', actif: false });
  const [form, setForm] = useState(stored);
  const [showCle, setShowCle] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(!stored.cleApi && !stored.actif);

  useEffect(() => {
    if (!stored.cleApi) {
      Promise.all([
        cloudGet(`api_config_${livreur.id}`),
        livreur.isOzone ? cloudGet('auzone_config') : Promise.resolve(null),
      ]).then(([cfg, oz]) => {
        if (cfg?.cleApi) {
          setForm(cfg);
          save(`api_config_${livreur.id}`, cfg);
        } else if (oz?.apiKey && livreur.isOzone) {
          setForm(p => ({ ...p, cleApi: oz.apiKey, customerId: oz.customerId || '' }));
        }
        setLoadingCloud(false);
      });
    } else {
      setLoadingCloud(false);
    }
  }, []);

  function handleSave() {
    save(`api_config_${livreur.id}`, form);
    cloudSet(`api_config_${livreur.id}`, form);
    /* Sync to shared auzone_config used by OzoneModal */
    if (livreur.isOzone) {
      const ozCfg = { customerId: form.customerId || '', apiKey: form.cleApi || '', endpoint: form.urlApi || 'https://api.ozonexpress.ma' };
      save('auzone_config', ozCfg);
      cloudSet('auzone_config', ozCfg);
    }
    onSave(form);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">Configuration API — {livreur.nom}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><XCircle size={16} className="text-gray-400" /></button>
        </div>

        {loadingCloud ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        ) : null}

        <div className={`space-y-3 ${loadingCloud ? 'opacity-30 pointer-events-none' : ''}`}>
          <div>
            <label className={labelCls}>Clé API</label>
            <div className="relative">
              <input
                type={showCle ? 'text' : 'password'}
                value={form.cleApi} onChange={(e) => setForm((p) => ({ ...p, cleApi: e.target.value }))}
                className={inputCls} placeholder="Votre clé API"
              />
              <button onClick={() => setShowCle(!showCle)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showCle ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Secret API</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={form.secretApi} onChange={(e) => setForm((p) => ({ ...p, secretApi: e.target.value }))}
                className={inputCls} placeholder="Votre secret API"
              />
              <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>URL API</label>
            <input
              value={form.urlApi} onChange={(e) => setForm((p) => ({ ...p, urlApi: e.target.value }))}
              className={inputCls} placeholder="https://api.ozonexpress.ma"
            />
          </div>
          {livreur.isOzone && (
            <div>
              <label className={labelCls}>ID Client (Ozon Express)</label>
              <input
                value={form.customerId || ''} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
                className={inputCls} placeholder="Votre ID Client Ozon"
              />
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm((p) => ({ ...p, actif: e.target.checked }))}
              className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-700">Activer l&apos;API</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function EditLivreurModal({ livreur, onClose, onSave }) {
  const [form, setForm] = useState({ ...livreur });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800">{livreur.id ? 'Modifier le livreur' : 'Nouveau livreur'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><XCircle size={16} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nom</label>
            <input value={form.nom} onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Téléphone</label>
            <input value={form.telephone} onChange={(e) => setForm((p) => ({ ...p, telephone: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Adresse</label>
            <input value={form.adresse} onChange={(e) => setForm((p) => ({ ...p, adresse: e.target.value }))} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.statut} onChange={(e) => setForm((p) => ({ ...p, statut: e.target.checked }))} className="w-4 h-4 accent-green-600" />
            <span className="text-sm text-gray-700">Actif</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={() => { onSave(form); onClose(); }} className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function EditFraisModal({ city, onClose, onSave }) {
  const [form, setForm] = useState({ ...city });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">{form.ville || 'Nouvelle ville'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><XCircle size={16} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Ville</label>
            <input
              value={form.ville || ''}
              onChange={(e) => setForm((p) => ({ ...p, ville: e.target.value }))}
              placeholder="Ex: Casablanca"
              className={inputCls}
            />
          </div>
          {[['livre', 'Frais Livré'], ['refuse', 'Frais Refusé'], ['annule', 'Frais Annulé'], ['change', 'Frais Changé']].map(([key, lbl]) => (
            <div key={key}>
              <label className={labelCls}>{lbl} (DH)</label>
              <input type="number" value={form[key] || 0}
                onChange={(e) => setForm((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                className={inputCls} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
          <button onClick={() => { onSave(form); onClose(); }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Frais de Livraison sub-page ─── */
function JsonImportModal({ onClose, onImport }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  function handleImport() {
    try {
      const raw = JSON.parse(text);

      /* Ozon Express returns: {"CITIES": {"37":{...}, "49":{...}}} */
      let arr;
      if (raw.CITIES && typeof raw.CITIES === 'object' && !Array.isArray(raw.CITIES)) {
        arr = Object.values(raw.CITIES);
      } else if (Array.isArray(raw)) {
        arr = raw;
      } else if (Array.isArray(raw.cities)) {
        arr = raw.cities;
      } else if (Array.isArray(raw.data)) {
        arr = raw.data;
      } else {
        /* Try any nested object/array */
        const nested = Object.values(raw).find((v) => typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 3);
        arr = nested ? Object.values(nested) : [];
      }

      if (!arr || arr.length === 0) { setErr('Aucune ville trouvée dans le JSON.'); return; }

      const mapped = arr.map((c, i) => ({
        id: String(c.ID || c.id || c.city_id || i + 1),
        ville: c.NAME || c.name || c.city_name || c.CITY_NAME || '?',
        livre:  parseFloat(c['DELIVERED-PRICE']  || c.delivered_price  || c.tarif_livre || c.price || 35) || 35,
        annule: parseFloat(c['RETURNED-PRICE']   || c.returned_price   || c.tarif_annule || 0)            || 0,
        refuse: parseFloat(c['REFUSED-PRICE']    || c.refused_price    || c.tarif_refuse || 0)            || 0,
        change: parseFloat(c['CHANGED-PRICE']    || c.changed_price    || c['DELIVERED-PRICE'] || c.price || 35) || 35,
      })).filter((c) => c.ville !== '?');

      if (mapped.length === 0) { setErr('Impossible de lire les villes. Vérifiez le format JSON.'); return; }
      onImport(mapped);
      onClose();
    } catch (e) { setErr('JSON invalide — ' + e.message); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Importer les villes — Coller JSON</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><XCircle size={16} className="text-gray-400" /></button>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 mb-3 space-y-1">
          <p className="font-semibold">Comment faire (CORS bloqué en local) :</p>
          <p>1. Ouvrez un nouvel onglet et allez sur : 
            <code className="bg-blue-100 px-1 rounded font-mono">https://api.ozonexpress.ma/cities</code>
          </p>
          <p>2. Copiez tout le texte JSON affiché (Ctrl+A puis Ctrl+C)</p>
          <p>3. Collez-le ci-dessous et cliquez Importer</p>
        </div>
        <textarea
          value={text} onChange={(e) => { setText(e.target.value); setErr(''); }}
          rows={8}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
          placeholder='[{"id":1,"name":"Casablanca"},{"id":2,"name":"Rabat"}...]'
        />
        {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">Annuler</button>
          <button onClick={handleImport} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600">
            Importer
          </button>
        </div>
      </div>
    </div>
  );
}

function FraisPage({ livreur, onBack }) {
  const key = `frais_${livreur.id}`;
  const [frais, setFrais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editCity, setEditCity] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    cloudGet(key).then(remote => {
      if (Array.isArray(remote) && remote.length) { setFrais(remote); save(key, remote); }
      setLoading(false);
    });
  }, [key]);

  function persist(data) { setFrais(data); save(key, data); cloudSet(key, data); }

  async function fetchFromOzone() {
    setLoading(true);
    try {
      /* 1. Public cities endpoint — confirmed working */
      const res = await fetch('https://api.ozonexpress.ma/cities');
      const raw = await res.json();

      let arr;
      if (raw.CITIES && typeof raw.CITIES === 'object' && !Array.isArray(raw.CITIES)) {
        arr = Object.values(raw.CITIES);
      } else if (Array.isArray(raw)) {
        arr = raw;
      } else if (Array.isArray(raw.cities)) {
        arr = raw.cities;
      } else {
        arr = Object.values(raw).find((v) => typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 3);
        arr = arr ? Object.values(arr) : [];
      }

      if (arr.length === 0) throw new Error('empty');

      /* Try to also get tarifs with credentials */
      const cfg = getOzoneConfig();
      const apiCfg = load(`api_config_${livreur.id}`, {});
      const customerId = apiCfg.customerId || cfg.customerId;
      const apiKey = apiCfg.cleApi || cfg.apiKey;
      let tarifMap = {};

      if (customerId && apiKey) {
        for (const ep of [
          `https://api.ozonexpress.ma/customers/${customerId}/${apiKey}/tarifs`,
          `https://api.ozonexpress.ma/customers/${customerId}/${apiKey}/prices`,
        ]) {
          try {
            const tr = await fetch(ep);
            const td = await tr.json();
            const ta = Array.isArray(td) ? td : Object.values(td).find(Array.isArray) || [];
            if (ta.length > 0) {
              ta.forEach((t) => {
                const name = (t.name || t.NAME || t.city_name || '').toLowerCase();
                if (name) tarifMap[name] = t;
              });
              break;
            }
          } catch {}
        }
      }

      const mapped = arr.map((c, i) => {
        const name = c.name || c.NAME || c.city_name || c.CITY_NAME || c.ville || '?';
        const t = tarifMap[name.toLowerCase()] || {};
        return {
          id: String(c.ID || c.id || c.city_id || i + 1),
          ville: name,
          livre:  parseFloat(c['DELIVERED-PRICE'] || t['DELIVERED-PRICE'] || t.tarif_livre || 35) || 35,
          refuse: parseFloat(c['REFUSED-PRICE']   || t['REFUSED-PRICE']   || t.tarif_refuse || 0) || 0,
          annule: parseFloat(c['RETURNED-PRICE']  || t['RETURNED-PRICE']  || t.tarif_annule || 0) || 0,
          change: parseFloat(c['CHANGED-PRICE']   || t['CHANGED-PRICE']   || c['DELIVERED-PRICE'] || 35) || 35,
        };
      });

      persist(mapped);
    } catch (err) {
      setFetchError('CORS bloqué — utilisez le bouton \u00ab Coller JSON \u00bb ci-dessous.');
    } finally {
      setLoading(false);
    }
  }

  const displayed = frais.filter((c) => c.ville.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            <ChevronLeft size={14} /> Retour
          </button>
          <h1 className="text-xl font-bold text-gray-800">Frais de Livraison — {livreur.nom}</h1>
        </div>
        <div className="flex items-center gap-2">
          {livreur.isOzone && (
            <>
              <button
                onClick={fetchFromOzone}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-60"
                title="Essayer fetch direct (peut être bloqué par CORS)"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Importer API
              </button>
              <button
                onClick={() => { setFetchError(''); setJsonOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                title="Coller le JSON de https://api.ozonexpress.ma/cities"
              >
                <Upload size={14} /> Coller JSON
              </button>
            </>
          )}
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
          >
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* CORS error banner */}
      {fetchError && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-center justify-between">
          <span>⚠️ {fetchError}</span>
          <button onClick={() => setFetchError('')} className="text-amber-500 hover:text-amber-700 text-lg leading-none">×</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une ville..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700 bg-gray-50">
          Frais de livraison par ville ({displayed.length})
        </div>
        {displayed.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <DollarSign size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun tarif. {livreur.isOzone ? 'Importez depuis l\'API ou ajoutez manuellement.' : 'Ajoutez des villes manuellement.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Ville', 'Frais Livré', 'Frais Refusé', 'Frais Annulé', 'Frais Changé', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {displayed.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.ville}</td>
                  <td className="px-4 py-3 text-green-700 font-semibold">{Number(c.livre).toFixed(2)} DH</td>
                  <td className="px-4 py-3 text-red-600">{Number(c.refuse).toFixed(2)} DH</td>
                  <td className="px-4 py-3 text-gray-500">{Number(c.annule).toFixed(2)} DH</td>
                  <td className="px-4 py-3 text-orange-600">{Number(c.change).toFixed(2)} DH</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditCity(c)} className="p-1.5 rounded bg-yellow-100 text-yellow-600 hover:bg-yellow-200">
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => { const updated = frais.filter((x) => x.id !== c.id); persist(updated); }}
                        className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* JSON Import Modal */}
      {jsonOpen && (
        <JsonImportModal
          onClose={() => setJsonOpen(false)}
          onImport={(mapped) => { persist(mapped); }}
        />
      )}

      {/* Add modal */}
      {addOpen && (
        <EditFraisModal
          city={{ id: Date.now(), ville: '', livre: 35, refuse: 0, annule: 0, change: 35 }}
          onClose={() => setAddOpen(false)}
          onSave={(c) => { persist([...frais, c]); setAddOpen(false); }}
        />
      )}

      {/* Edit modal */}
      {editCity && (
        <EditFraisModal
          city={editCity}
          onClose={() => setEditCity(null)}
          onSave={(updated) => { persist(frais.map((c) => c.id === updated.id ? updated : c)); setEditCity(null); }}
        />
      )}
    </div>
  );
}

/* ─── Main LivraisonPage ─── */
export default function LivraisonPage() {
  const [livreurs, setLivreurs] = useState(DEFAULT_LIVREURS);
  const [loading, setLoading] = useState(true);
  const [apiModal, setApiModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [fraisLivreur, setFraisLivreur] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    cloudGet('livreurs').then(remote => {
      if (Array.isArray(remote) && remote.length) setLivreurs(remote);
      setLoading(false);
    });
    /* Pre-cache configs */
    cloudGet('auzone_config').then(remote => { if (remote?.apiKey) save('auzone_config', remote); });
    [1, 2].forEach(id => {
      cloudGet(`api_config_${id}`).then(remote => { if (remote) save(`api_config_${id}`, remote); });
    });
  }, []);

  function persist(data) { setLivreurs(data); save('livreurs', data); cloudSet('livreurs', data); }

  function deleteLivreur(id) {
    if (!confirm('Supprimer ce livreur ?')) return;
    persist(livreurs.filter((l) => l.id !== id));
  }

  if (fraisLivreur) {
    return <FraisPage livreur={fraisLivreur} onBack={() => setFraisLivreur(null)} />;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 gap-2 text-gray-400"><Loader2 size={20} className="animate-spin" /><span>Chargement...</span></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestion des Livreurs</h1>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus size={14} /> Nouveau Livreur
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700 bg-gray-50">
          Liste des Livreurs
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Nom', 'Téléphone', 'Adresse', 'Statut', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {livreurs.map((l) => {
              const apiCfg = load(`api_config_${l.id}`, {});
              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${l.isOzone ? 'text-orange-600' : 'text-blue-700'}`}>{l.nom}</span>
                    {apiCfg.actif && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">API</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.telephone || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{l.adresse || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${l.statut ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {l.statut ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* API Config */}
                      <button
                        onClick={() => setApiModal(l)}
                        className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200"
                        title="Configuration API"
                      >
                        <Settings size={13} />
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => setEditModal(l)}
                        className="p-1.5 rounded bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                        title="Modifier"
                      >
                        <Pencil size={13} />
                      </button>
                      {/* Frais */}
                      <button
                        onClick={() => setFraisLivreur(l)}
                        className="p-1.5 rounded bg-green-500 text-white hover:bg-green-600"
                        title="Frais de livraison"
                      >
                        <DollarSign size={13} />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => deleteLivreur(l.id)}
                        className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* API Config Modal */}
      {apiModal && (
        <ApiConfigModal
          livreur={apiModal}
          onClose={() => setApiModal(null)}
          onSave={() => {}}
        />
      )}

      {/* Edit Modal */}
      {editModal && (
        <EditLivreurModal
          livreur={editModal}
          onClose={() => setEditModal(null)}
          onSave={(updated) => persist(livreurs.map((l) => l.id === updated.id ? updated : l))}
        />
      )}

      {/* New Livreur Modal */}
      {newOpen && (
        <EditLivreurModal
          livreur={{ id: Date.now(), nom: '', telephone: '', adresse: '', statut: true, isOzone: false }}
          onClose={() => setNewOpen(false)}
          onSave={(l) => { persist([...livreurs, l]); setNewOpen(false); }}
        />
      )}
    </div>
  );
}

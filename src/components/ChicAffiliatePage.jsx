import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Settings, Search, ChevronDown, ChevronRight, RefreshCw,
  Download, Loader2, AlertCircle, CheckCircle2, Check, Package, ShoppingCart,
  Send, Pencil, Trash2, Clock, X,
} from 'lucide-react';
import HistoryModal from './orders/HistoryModal';
import {
  getChicConfig, saveChicConfig, fetchChicOrders, fetchChicProducts,
  fetchChicCounts, fetchChicProductDetails, createChicOrder, stripHtml,
  discoverChicApi, diagnoseChicProduct, diagnoseChicList,
} from '../lib/chicAffiliate';
import { loadProducts, saveProducts } from '../data/products';

/* Statuts propres aux commandes Chic (pipeline site -> livraison -> facture). */
const CHIC_ORDER_STATUSES = [
  { key: 'chic_nouveau', label: 'Nouvelle', cls: 'bg-purple-100 text-purple-700' },
  { key: 'chic_envoye', label: 'Envoyée', cls: 'bg-blue-100 text-blue-700' },
  { key: 'chic_livre', label: 'Livrée', cls: 'bg-green-100 text-green-700' },
  { key: 'chic_facture', label: 'Facturée', cls: 'bg-gray-800 text-white' },
];
const chicStatusMeta = (k) => CHIC_ORDER_STATUSES.find(s => s.key === k) || CHIC_ORDER_STATUSES[0];

/* Mémoire locale des frais de livraison par ville : Chic charge le tarif via
   AJAX (absent du HTML), donc on retient ce que l'utilisateur saisit et on
   le repropose automatiquement pour la même ville les fois suivantes. */
const CITY_FRAIS_KEY = 'chic_city_frais';
const cityKey = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function getCityFraisMap() { try { return JSON.parse(localStorage.getItem(CITY_FRAIS_KEY) || '{}'); } catch { return {}; } }
function rememberCityFrais(cityName, frais) {
  const k = cityKey(cityName); const f = parseFloat(frais);
  if (!k || !f) return;
  try { const m = getCityFraisMap(); m[k] = f; localStorage.setItem(CITY_FRAIS_KEY, JSON.stringify(m)); } catch {}
}
function recallCityFrais(cityName) { const v = getCityFraisMap()[cityKey(cityName)]; return v != null ? String(v) : ''; }
function setCityFraisValue(cityName, val) {
  const k = cityKey(cityName); if (!k) return;
  try {
    const m = getCityFraisMap(); const f = parseFloat(val);
    if (val === '' || isNaN(f)) delete m[k]; else m[k] = f;
    localStorage.setItem(CITY_FRAIS_KEY, JSON.stringify(m));
  } catch {}
}

/* ── Status badge ── */
function StatusBadge({ raw }) {
  const text = stripHtml(raw).trim();
  const lower = text.toLowerCase();
  let color = 'bg-gray-100 text-gray-700';
  if (lower.includes('livré') || lower.includes('delivered')) color = 'bg-green-100 text-green-700';
  else if (lower.includes('confirmé') || lower.includes('confirmed')) color = 'bg-blue-100 text-blue-700';
  else if (lower.includes('annulé') || lower.includes('cancel')) color = 'bg-red-100 text-red-700';
  else if (lower.includes('expédié') || lower.includes('shipped') || lower.includes('en cours')) color = 'bg-yellow-100 text-yellow-700';
  else if (lower.includes('retour') || lower.includes('return')) color = 'bg-orange-100 text-orange-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${color}`}>{text || '—'}</span>;
}

/* ── Config Panel ── */
function ConfigPanel({ onTest }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState(() => getChicConfig() || { xsrfToken: '', sessionCookie: '', apiKey: '' });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [apiResults, setApiResults] = useState(null);
  const [apiTesting, setApiTesting] = useState(false);
  const [diagId, setDiagId] = useState('');
  const [diagResult, setDiagResult] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  async function runDiag() {
    if (!diagId.trim()) return;
    save(config);
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const d = await diagnoseChicProduct(diagId.trim());
      setDiagResult(d);
    } catch (e) {
      setDiagResult({ error: e.message });
    } finally {
      setDiagLoading(false);
    }
  }

  async function runListDiag() {
    save(config);
    setDiagLoading(true);
    setDiagResult(null);
    try {
      setDiagResult(await diagnoseChicList());
    } catch (e) {
      setDiagResult({ error: e.message });
    } finally {
      setDiagLoading(false);
    }
  }

  async function testApiKey() {
    save(config);
    setApiTesting(true);
    setApiResults(null);
    try {
      const results = await discoverChicApi();
      setApiResults(results);
    } catch (e) {
      setApiResults([{ path: '—', status: 0, sample: e.message }]);
    } finally {
      setApiTesting(false);
    }
  }

  function save(c) {
    setConfig(c);
    saveChicConfig(c);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      save(config);
      const data = await fetchChicCounts();
      setTestResult({ ok: true, msg: `Connexion réussie — ${JSON.stringify(data)}` });
      onTest?.(true);
    } catch (e) {
      setTestResult({ ok: false, msg: e.message });
      onTest?.(false);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition rounded-xl"
      >
        <Settings size={16} className="text-gray-400" />
        <span>Configuration Chic Affiliate</span>
        {open ? <ChevronDown size={14} className="ml-auto" /> : <ChevronRight size={14} className="ml-auto" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Ouvrez chic-affiliate.com &rarr; F12 &rarr; Application &rarr; Cookies &rarr; copiez XSRF-TOKEN et laravel_session
          </p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">XSRF-TOKEN</label>
            <input
              type="text"
              value={config.xsrfToken}
              onChange={e => save({ ...config, xsrfToken: e.target.value })}
              placeholder="Collez le XSRF-TOKEN ici"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Laravel Session</label>
            <input
              type="text"
              value={config.sessionCookie}
              onChange={e => save({ ...config, sessionCookie: e.target.value })}
              placeholder="Collez le laravel_session ici"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Clé API (profil Chic → «&nbsp;Clé API&nbsp;», commence par CHIC_)</label>
            <input
              type="text"
              value={config.apiKey || ''}
              onChange={e => save({ ...config, apiKey: e.target.value.trim() })}
              placeholder="CHIC_xxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Tester la connexion
            </button>
            <button
              onClick={testApiKey}
              disabled={apiTesting || !(config.apiKey || '').trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              {apiTesting ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Tester la Clé API
            </button>
          </div>
          {apiResults && (
            <div className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-2 space-y-1 max-h-64 overflow-y-auto font-mono">
              {apiResults.map(r => (
                <div key={r.path} className={r.status >= 200 && r.status < 300 ? 'text-green-700 font-bold' : r.status === 401 || r.status === 403 ? 'text-orange-600' : 'text-gray-400'}>
                  [{r.status}] {r.path} — {r.sample}
                </div>
              ))}
              <p className="text-gray-500 pt-1 font-sans">Vert = endpoint fonctionnel · Orange = existe mais refuse la clé · Gris = introuvable</p>
            </div>
          )}

          {/* Diagnostic produit : voir ce que le parseur lit (tailles/couleurs) */}
          <div className="border-t border-gray-100 pt-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Diagnostic produit (ID Chic, ex : 203)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={diagId}
                onChange={e => setDiagId(e.target.value)}
                placeholder="203"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              <button
                onClick={runDiag}
                disabled={diagLoading || !diagId.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
              >
                {diagLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Produit
              </button>
              <button
                onClick={runListDiag}
                disabled={diagLoading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
              >
                {diagLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Liste
              </button>
            </div>
            {diagResult && (
              <pre className="mt-2 text-[11px] bg-gray-900 text-green-300 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-72 overflow-y-auto">
{JSON.stringify(diagResult, null, 2)}
              </pre>
            )}
          </div>
          {testResult && (
            <div className={`text-xs p-2 rounded-lg ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.ok ? <CheckCircle2 size={12} className="inline mr-1" /> : <AlertCircle size={12} className="inline mr-1" />}
              {testResult.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Products Tab ── */
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [importedIds, setImportedIds] = useState(() => {
    try {
      const prods = loadProducts();
      return new Set(prods.filter(p => p.source === 'chic-affiliate').map(p => p.chicId || p.name?.toLowerCase()));
    } catch { return new Set(); }
  });
  const [importedNames, setImportedNames] = useState(() => {
    try {
      const prods = loadProducts();
      return new Set(prods.filter(p => p.source === 'chic-affiliate').map(p => p.name?.toLowerCase()).filter(Boolean));
    } catch { return new Set(); }
  });
  /* Produits Chic masqués localement (pour ne garder que ceux utilisés). */
  const [hiddenIds, setHiddenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('chic_hidden_ids') || '[]')); } catch { return new Set(); }
  });
  const [showHidden, setShowHidden] = useState(false);
  function persistHidden(next) {
    localStorage.setItem('chic_hidden_ids', JSON.stringify([...next]));
    setHiddenIds(new Set(next));
  }
  function hideProduct(p) {
    const key = p.chicId || p.name;
    if (!key) return;
    if (!window.confirm(`Masquer « ${p.name} » de la liste ?\n(Il reste chez Chic, vous pourrez le réafficher.)`)) return;
    const next = new Set(hiddenIds); next.add(key); persistHidden(next);
  }
  function unhideProduct(p) {
    const next = new Set(hiddenIds); next.delete(p.chicId || p.name); persistHidden(next);
  }
  const isHidden = p => hiddenIds.has(p.chicId || p.name);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChicProducts();
      const chicList = data.data || [];
      setProducts(chicList);
      setTotal(data.recordsTotal || 0);
      if (data.html && chicList.length === 0) {
        setError('Produits non détectés — vérifiez la connexion');
      }
      if (chicList.length > 0) {
        const stored = loadProducts();
        let changed = false;
        const updated = stored.map(p => {
          if (p.source === 'chic-affiliate' && !p.chicId && p.name) {
            const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
            const match = chicList.find(c => norm(c.name) === norm(p.name))
              || chicList.find(c => norm(c.name).includes(norm(p.name)) || norm(p.name).includes(norm(c.name)));
            if (match?.chicId) {
              changed = true;
              return { ...p, chicId: match.chicId, ref: `CHIC-${match.chicId}` };
            }
          }
          return p;
        });
        if (changed) saveProducts(updated);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const [importing, setImporting] = useState(null);

  async function importProduct(p) {
    try {
      const existing = loadProducts();
      const already = existing.find(x =>
        (p.chicId && x.chicId === p.chicId) ||
        (p.name && x.source === 'chic-affiliate' && x.name?.toLowerCase() === p.name.toLowerCase())
      );
      if (already) {
        if (!importingAllRef.current) alert('Produit déjà importé');
        return;
      }
      setImporting(p.chicId || p.name);

      let details = { sizes: [], colors: [], images: [], description: '' };
      if (p.chicId) {
        try {
          details = await fetchChicProductDetails(p.chicId);
        } catch {}
      }

      const sale = parseFloat((p.salePrice || '0').toString().replace(/[^\d.]/g, ''));
      const purchase = parseFloat((p.resellerPrice || '0').toString().replace(/[^\d.]/g, ''));

      const sizes = details.sizes.length > 0 ? details.sizes : ['S', 'M', 'L', 'XL'];
      const variations = sizes.map(t => ({ taille: t, stock: 10, prix: sale, compareAt: sale, ajust: 0 }));

      const allImages = details.images.length > 0 ? details.images : (p.image ? [p.image] : []);

      const newProd = {
        id: p.chicId ? `CHIC-${p.chicId}` : `CHIC-${Date.now()}`,
        ref: p.chicId ? `CHIC-${p.chicId}` : `CHIC-${Date.now()}`,
        chicId: p.chicId,
        name: p.name || '',
        image: allImages[0] || p.image || null,
        images: allImages,
        colors: details.colors,
        description: details.description,
        statut: 'Active',
        boutique: 'Chic Affiliate',
        shopifyId: '',
        prix: sale,
        compareAt: sale,
        etiquette: '',
        source: 'chic-affiliate',
        purchasePrice: purchase,
        stock_quantity: 10,
        variations,
      };
      const updated = [newProd, ...existing];
      saveProducts(updated);
      if (p.chicId) setImportedIds(prev => new Set([...prev, p.chicId]));
      if (p.name) setImportedNames(prev => new Set([...prev, p.name.toLowerCase()]));
      if (!importingAllRef.current) alert(`✅ Produit importé avec ${allImages.length} images, ${details.colors.length} couleurs, ${sizes.length} tailles !`);
    } catch (e) {
      alert('Erreur: ' + e.message);
    } finally {
      setImporting(null);
    }
  }

  const [importingAll, setImportingAll] = useState(false);
  const importingAllRef = React.useRef(false);
  const [importProgress, setImportProgress] = useState('');

  async function importAll() {
    const notImported = filtered.filter(p => !isImported(p));
    if (notImported.length === 0) { alert('Tous les produits sont déjà importés !'); return; }
    if (!window.confirm(`Importer ${notImported.length} produits ?`)) return;

    setImportingAll(true);
    importingAllRef.current = true;
    let success = 0, fail = 0;
    for (let i = 0; i < notImported.length; i++) {
      const p = notImported[i];
      setImportProgress(`${i + 1}/${notImported.length}: ${p.name || '...'}`);
      try {
        await importProduct(p);
        success++;
      } catch {
        fail++;
      }
    }
    setImportingAll(false);
    importingAllRef.current = false;
    setImportProgress('');
    alert(`✅ ${success} produits importés${fail ? `, ${fail} erreurs` : ''} !`);
  }

  const filtered = products
    .filter(p => !search || (p.name || '').toLowerCase().includes(search.toLowerCase()))
    .filter(p => showHidden ? true : !isHidden(p));
  const hiddenCount = products.filter(isHidden).length;

  function isImported(p) {
    if (p.chicId && importedIds.has(p.chicId)) return true;
    if (p.name && importedNames.has(p.name.toLowerCase())) return true;
    return false;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const notImportedCount = filtered.filter(p => !isImported(p)).length;

  return (
    <div className="space-y-4">
      {/* Search + Import All */}
      <div className="flex gap-2">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>
      {notImportedCount > 0 && (
        <button
          onClick={importAll}
          disabled={importingAll}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition whitespace-nowrap disabled:opacity-50"
        >
          {importingAll ? <><Loader2 size={14} className="animate-spin" /> {importProgress}</> : <><Download size={14} /> Importer Tout ({notImportedCount})</>}
        </button>
      )}
      </div>

      {hiddenCount > 0 && (
        <button onClick={() => setShowHidden(v => !v)} className="text-xs text-gray-500 hover:text-gray-700 underline">
          {showHidden ? `Cacher les ${hiddenCount} produit(s) masqué(s)` : `Afficher les ${hiddenCount} produit(s) masqué(s)`}
        </button>
      )}

      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg"><AlertCircle size={14} className="inline mr-1" />{error}</div>}

      {loading ? (
        <div className="flex flex-col gap-2 py-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 w-full bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">Image</th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Prix Vente</th>
                  <th className="px-3 py-2">Prix Revendeur</th>
                  <th className="px-3 py-2">Bénéfice</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const sale = parseFloat((p.salePrice || p.sale_price || '0').toString().replace(/[^\d.]/g, ''));
                  const purchase = parseFloat((p.resellerPrice || p.purchase_price || '0').toString().replace(/[^\d.]/g, ''));
                  const profit = sale - purchase;
                  return (
                    <tr key={p.id || i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        {p.image ? <img src={p.image} alt={p.name} referrerPolicy="no-referrer" className="w-12 h-12 object-cover rounded-lg" onError={e => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }} /> : null}
                        <div className="w-12 h-12 bg-gray-100 rounded-lg items-center justify-center" style={{ display: p.image ? 'none' : 'flex' }}><Package size={16} className="text-gray-400" /></div>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{p.name || '—'}</td>
                      <td className="px-3 py-2">{sale.toFixed(2)} Dhs</td>
                      <td className="px-3 py-2">{purchase.toFixed(2)} Dhs</td>
                      <td className="px-3 py-2 text-green-600 font-medium">{profit.toFixed(2)} Dhs</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {isImported(p) ? (
                            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-medium">
                              <Check size={12} /> Importé
                            </span>
                          ) : (
                            <button
                              onClick={() => importProduct(p)}
                              disabled={importing === (p.chicId || p.name)}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                            >
                              {importing === (p.chicId || p.name) ? <><Loader2 size={12} className="animate-spin" /> Chargement...</> : <><Download size={12} /> Importer</>}
                            </button>
                          )}
                          {isHidden(p)
                            ? <button onClick={() => unhideProduct(p)} title="Réafficher" className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition"><RefreshCw size={13} /></button>
                            : <button onClick={() => hideProduct(p)} title="Masquer / supprimer de la liste" className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition"><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Aucun produit</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((p, i) => {
              const sale = parseFloat((p.salePrice || p.sale_price || '0').toString().replace(/[^\d.]/g, ''));
              const purchase = parseFloat((p.resellerPrice || p.purchase_price || '0').toString().replace(/[^\d.]/g, ''));
              const profit = sale - purchase;
              return (
                <div key={p.id || i} className="bg-white border border-gray-200 rounded-lg p-3 flex gap-3">
                  {p.image ? <img src={p.image} alt={p.name} referrerPolicy="no-referrer" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" onError={e => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }} /> : null}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg items-center justify-center flex-shrink-0" style={{ display: p.image ? 'none' : 'flex' }}><Package size={20} className="text-gray-400" /></div>
                  <div className="flex-1 space-y-1">
                    <div className="font-medium text-gray-800 text-sm">{p.name || '—'}</div>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Vente: {sale.toFixed(2)} Dhs</span>
                      <span>Achat: {purchase.toFixed(2)} Dhs</span>
                      <span className="text-green-600 font-medium">+{profit.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isImported(p) ? (
                        <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-medium w-fit">
                          <Check size={12} /> Importé
                        </span>
                      ) : (
                        <button
                          onClick={() => importProduct(p)}
                          disabled={importing === (p.chicId || p.name)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {importing === (p.chicId || p.name) ? <><Loader2 size={12} className="animate-spin" /> Chargement...</> : <><Download size={12} /> Importer</>}
                        </button>
                      )}
                      {isHidden(p)
                        ? <button onClick={() => unhideProduct(p)} title="Réafficher" className="p-1.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"><RefreshCw size={13} /></button>
                        : <button onClick={() => hideProduct(p)} title="Masquer" className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200"><Trash2 size={13} /></button>}
                    </div>
                  </div>
                </div>
              );
            })}
            {!filtered.length && <p className="text-center py-8 text-gray-400 text-sm">Aucun produit</p>}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">{total} produits au total</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Préc.</button>
                <span className="text-xs text-gray-600 px-2">{page + 1}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv.</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Orders Tab ── */
function OrdersTab({ victouryOrders = [], setVictouryOrders }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [syncMsg, setSyncMsg] = useState(null);
  const PAGE_SIZE = 50;

  /* Synchronise les statuts : si Chic indique « Livré » pour une commande
     envoyée (match par téléphone + nom de produit), on passe la commande
     Victoury à « Livrée » (elle rejoint alors l'onglet Factures). */
  function syncStatuses() {
    const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const base = s => norm(s).split(/\s*[-–—/|]\s*/)[0].trim();
    const phoneKey = s => (s || '').replace(/\D/g, '').slice(-9);
    const byPhone = new Map();
    orders.forEach(c => {
      const k = phoneKey(c.Recipient_phone);
      if (!k) return;
      if (!byPhone.has(k)) byPhone.set(k, []);
      byPhone.get(k).push(c);
    });
    let livrees = 0, retours = 0;
    setVictouryOrders?.(prev => prev.map(o => {
      if (o.status !== 'chic_envoye') return o;
      const cands = byPhone.get(phoneKey(o.recipient?.phone)) || [];
      const b = base(o.product?.name);
      const match = cands.find(c => { const cb = base(c.product?.name); return cb && (cb === b || cb.includes(b) || b.includes(cb)); }) || cands[0];
      if (!match) return o;
      const st = stripHtml(match.status || '').toLowerCase();
      if (st.includes('livr')) { livrees++; return { ...o, status: 'chic_livre', dateUpdated: new Date().toLocaleString('fr-MA'), manuallyModified: true }; }
      if (st.includes('retour') || st.includes('return')) { retours++; }
      return o;
    }));
    setSyncMsg(`${livrees} commande(s) passée(s) à « Livrée »${retours ? ` · ${retours} en retour (non modifiées)` : ''}. ${orders.length ? '' : 'Cliquez d\'abord sur « Charger ».'}`);
  }

  const load = useCallback(async (start = 0) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChicOrders(startDate, endDate, start, PAGE_SIZE);
      setOrders(data.data || []);
      setTotal(data.recordsTotal || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { load(page * PAGE_SIZE); }, [page, load]);

  function importOrder(o) {
    try {
      const existing = JSON.parse(localStorage.getItem('victoury_products') || '[]');
      const productName = o.product?.name || 'Produit Chic';
      const newOrder = {
        id: `CHIC-${o.id}`,
        recipient: {
          name: o.Recipient || '',
          phone: o.Recipient_phone || '',
          city: o.ville || '',
          address: '',
          delivery: null,
        },
        product: {
          name: productName,
          size: o.size || '',
          color: '',
          qty: o.quantity || 1,
          stock: 0,
        },
        price: parseFloat(stripHtml(o.sale_price || '0')),
        status: 'nouveau',
        note: o.comment || '',
        dateAdded: new Date(o.created_at).toLocaleString('fr-MA'),
        dateUpdated: new Date().toLocaleString('fr-MA'),
        validated: false,
        source: 'chic-affiliate',
      };
      // Dispatch to parent app via custom event
      window.dispatchEvent(new CustomEvent('chic-import-order', { detail: newOrder }));
      alert(`Commande #${o.id} importée`);
    } catch (e) {
      alert('Erreur: ' + e.message);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date début</label>
          <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(0); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date fin</label>
          <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(0); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <button onClick={() => { setPage(0); load(0); }} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
          <RefreshCw size={14} /> Charger
        </button>
        <button onClick={syncStatuses} disabled={!orders.length} title="Passe les commandes envoyées à « Livrée » selon le statut Chic" className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50">
          <CheckCircle2 size={14} /> Synchroniser les statuts
        </button>
      </div>

      {syncMsg && <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg"><CheckCircle2 size={14} className="inline mr-1" />{syncMsg}</div>}
      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg"><AlertCircle size={14} className="inline mr-1" />{error}</div>}

      {loading ? (
        <div className="flex flex-col gap-2 py-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 w-full bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2">N&#176;</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Téléphone</th>
                  <th className="px-3 py-2">Ville</th>
                  <th className="px-3 py-2">Produit</th>
                  <th className="px-3 py-2">Taille</th>
                  <th className="px-3 py-2">Prix</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                    <td className="px-3 py-2">{o.Recipient || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{o.Recipient_phone || '—'}</td>
                    <td className="px-3 py-2">{o.ville || '—'}</td>
                    <td className="px-3 py-2">{o.product?.name || '—'}</td>
                    <td className="px-3 py-2">{o.size || '—'}</td>
                    <td className="px-3 py-2">{stripHtml(o.sale_price || '')} </td>
                    <td className="px-3 py-2"><StatusBadge raw={o.status} /></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{o.created_at ? new Date(o.created_at).toLocaleDateString('fr-MA') : '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => importOrder(o)} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">
                        <Download size={12} /> Importer
                      </button>
                    </td>
                  </tr>
                ))}
                {!orders.length && (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">Aucune commande</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {orders.map(o => (
              <div key={o.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-500">#{o.id}</span>
                  <StatusBadge raw={o.status} />
                </div>
                <div className="font-medium text-sm text-gray-800">{o.Recipient || '—'}</div>
                <div className="text-xs text-gray-600 flex flex-wrap gap-x-3">
                  <span>{o.Recipient_phone}</span>
                  <span>{o.product?.name || '—'}</span>
                  <span>{o.size || ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">{stripHtml(o.sale_price || '')}</span>
                  <button onClick={() => importOrder(o)} className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition">
                    <Download size={12} /> Importer
                  </button>
                </div>
              </div>
            ))}
            {!orders.length && <p className="text-center py-8 text-gray-400 text-sm">Aucune commande</p>}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">{total} commandes au total</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Préc.</button>
                <span className="text-xs text-gray-600 px-2">{page + 1}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Suiv.</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Commandes du site (victoury-maroc.com) sur des produits Chic ──
   Ces commandes arrivent avec le statut chic_nouveau (routées hors « À Confirmer »
   par App.jsx) et s'envoient à Chic Affiliate en un clic : produit, taille,
   couleur et ville sont résolus automatiquement. */
function SiteOrderEditModal({ order, onClose, onSave }) {
  const r = order.recipient || {};
  const [form, setForm] = useState({
    name: r.name || '', phone: r.phone || '', city: r.city || '', address: r.address || '',
    price: order.price || '', size: order.product?.size || '', qty: order.product?.qty || 1,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const field = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300';
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Modifier {order.id}</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Nom du client</label><input className={field} value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</label><input className={field} value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Ville</label><input className={field} value={form.city} onChange={e => set('city', e.target.value)} /></div>
          <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Adresse</label><input className={field} value={form.address} onChange={e => set('address', e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Prix (DH)</label><input type="number" className={field} value={form.price} onChange={e => set('price', e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Taille</label><input className={field} value={form.size} onChange={e => set('size', e.target.value)} /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Quantité</label><input type="number" min="1" className={field} value={form.qty} onChange={e => set('qty', e.target.value)} /></div>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button
            onClick={() => onSave({
              ...order,
              recipient: { ...r, name: form.name, phone: form.phone, city: form.city, address: form.address },
              price: parseFloat(form.price) || 0,
              product: { ...(order.product || {}), size: form.size, qty: parseInt(form.qty, 10) || 1 },
            })}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
          >Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* Formulaire d'envoi vers Chic, calqué sur chic-affiliate.com : nom du produit,
   boutons de taille, pastilles de couleur, ville (liste Chic) — pré-rempli
   depuis la commande du site. L'utilisateur confirme puis envoie. */
function SendToChicModal({ order, chicProduct, onClose, onSent }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    size: '', color: '', quantity: order.product?.qty || 1, price: order.price || '',
    recipient: order.recipient?.name || '', phone: order.recipient?.phone || '',
    villeId: '', fraisLivraison: '', address: order.recipient?.address || '', comment: order.note || '',
  });

  /* Frais auto-remplis : d'abord ceux fournis par Chic (rares), sinon la
     valeur mémorisée localement pour cette ville. */
  const setVille = (villeId) => {
    const c = (details?.cities || []).find(x => String(x.id) === String(villeId));
    const frais = (c?.frais ? String(c.frais) : '') || recallCityFrais(c?.name) || '';
    setForm(f => ({ ...f, villeId, fraisLivraison: frais || f.fraisLivraison }));
  };

  const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchChicProductDetails(chicProduct.chicId);
        if (!alive) return;
        setDetails(d);
        const wantSize = (order.product?.size || '').toUpperCase().trim();
        const size = (d.sizes || []).find(s => s.toUpperCase() === wantSize) || d.sizes?.[0] || '';
        const cityN = norm(order.recipient?.city);
        const city = (d.cities || []).find(c => norm(c.name) === cityN)
          || (d.cities || []).find(c => norm(c.name).includes(cityN) || cityN.includes(norm(c.name)));
        const frais0 = (city?.frais ? String(city.frais) : '') || recallCityFrais(city?.name) || '';
        setForm(f => ({ ...f, size, color: d.colors?.[0]?.id || '', villeId: city?.id || '', fraisLivraison: frais0 }));
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [chicProduct.chicId]);

  async function submit() {
    if (!details?.token) { setError('Produit non chargé'); return; }
    if (!form.recipient || !form.phone || !form.villeId || !form.address) { setError('Remplissez nom, téléphone, ville et adresse'); return; }
    setSending(true); setError(null);
    try {
      await createChicOrder({
        token: details.token, productId: details.productId,
        size: form.size, color: form.color, quantity: form.quantity,
        recipientPrice: form.price, recipient: form.recipient, phone: form.phone,
        villeId: form.villeId, fraisLivraison: form.fraisLivraison || '', address: form.address, comment: form.comment,
      });
      /* Retenir le frais saisi pour cette ville (auto-remplissage futur). */
      const cityName = (details.cities || []).find(c => String(c.id) === String(form.villeId))?.name;
      rememberCityFrais(cityName, form.fraisLivraison);
      onSent(order.id, { fraisLivraison: parseFloat(form.fraisLivraison) || 0, price: parseFloat(form.price) || order.price });
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  const field = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300';
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="font-bold text-gray-900">Envoyer à Chic Affiliate</h2>
            <p className="text-xs text-gray-500 mt-0.5">{chicProduct.name} · {order.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100"><X size={15} className="text-gray-400" /></button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 px-6 py-10 justify-center"><Loader2 size={16} className="animate-spin" /> Chargement du produit Chic…</div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            {/* Taille */}
            {details?.sizes?.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Choisir la taille</label>
                <div className="flex gap-1.5 flex-wrap">
                  {details.sizes.map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, size: s }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${form.size === s ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 hover:bg-gray-50'}`}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {/* Couleur */}
            {details?.colors?.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Choisir la couleur</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {details.colors.map(c => (
                    <button key={c.id} type="button" title={c.label || `#${c.id}`} onClick={() => setForm(f => ({ ...f, color: c.id }))}
                      className={`w-8 h-8 rounded-full border-2 transition ${form.color === c.id ? 'border-green-600 scale-110' : 'border-gray-300'}`}
                      style={{ backgroundColor: c.bg || '#ddd' }} />
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Quantité</label><input type="number" min="1" className={field} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Prix de vente (DH)</label><input type="number" className={field} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 border-t pt-3">Informations client</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Nom du client *</label><input className={field} value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone *</label><input className={field} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 border-t pt-3">Livraison</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ville *</label>
                <select className={field} value={form.villeId} onChange={e => setVille(e.target.value)}>
                  <option value="">— Sélectionnez —</option>
                  {(details?.cities || []).map(c => <option key={c.id} value={c.id}>{c.name}{c.frais ? ` (${c.frais} DH)` : ''}</option>)}
                </select>
                {!details?.cities?.length && <p className="text-xs text-orange-600 mt-1">Liste des villes indisponible — reconnectez-vous si besoin.</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tarif de livraison (DH)</label>
                <input type="number" className={field} value={form.fraisLivraison} onChange={e => setForm(f => ({ ...f, fraisLivraison: e.target.value }))} placeholder="auto" />
              </div>
            </div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Adresse de livraison *</label><textarea rows={2} className={field} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Commentaire</label><textarea rows={2} className={field} value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} /></div>

            {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded-lg"><AlertCircle size={13} className="inline mr-1" />{error}</div>}
          </div>
        )}

        <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={sending || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Envoyer à Chic
          </button>
        </div>
      </div>
    </div>
  );
}

function SiteOrdersTab({ orders = [], setOrders, onDeleteOrder }) {
  const [result, setResult] = useState(null);   /* { id, ok, msg } */
  const [editOrder, setEditOrder] = useState(null);
  const [historyOrder, setHistoryOrder] = useState(null);
  const [sendModal, setSendModal] = useState(null); /* { order, chicProduct } */

  function deleteOrder(o) {
    if (!window.confirm(`Supprimer la commande ${o.id} de Victoury ?\n\n(La commande déjà envoyée reste chez Chic Affiliate — supprimez-la depuis leur tableau si besoin.)`)) return;
    onDeleteOrder?.(o.id);
    setOrders?.(prev => prev.filter(x => x.id !== o.id));
  }
  function setStatus(id, status) {
    setOrders?.(prev => prev.map(o => o.id === id
      ? { ...o, status, dateUpdated: new Date().toLocaleString('fr-MA'), manuallyModified: true } : o));
  }
  const StatusSelect = ({ o }) => (
    <select
      value={o.status}
      onChange={e => setStatus(o.id, e.target.value)}
      className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer ${chicStatusMeta(o.status).cls}`}
    >
      {CHIC_ORDER_STATUSES.map(s => <option key={s.key} value={s.key} className="bg-white text-gray-800">{s.label}</option>)}
    </select>
  );
  function saveEdit(updated) {
    setOrders?.(prev => prev.map(o => o.id === updated.id ? { ...updated, manuallyModified: true } : o));
    setEditOrder(null);
  }
  const ActionButtons = ({ o }) => (
    <div className="flex items-center gap-1">
      {o.status !== 'chic_envoye' && (
        <button
          onClick={() => openSend(o)}
          className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
        >
          <Send size={12} /> Envoyer à Chic
        </button>
      )}
      <button onClick={() => setEditOrder(o)} title="Modifier" className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition"><Pencil size={13} /></button>
      <button onClick={() => setHistoryOrder(o)} title="Historique" className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition"><Clock size={13} /></button>
      <button onClick={() => deleteOrder(o)} title="Supprimer" className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200 transition"><Trash2 size={13} /></button>
    </div>
  );

  /* Commandes Site = pipeline actif (avant facturation). Livrées/Facturées
     passent dans l'onglet Factures. */
  const siteOrders = orders.filter(o => o.status === 'chic_nouveau' || o.status === 'chic_envoye');
  const norm = s => (s || '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();

  /* Retire la ou les variantes accolées au nom (« - S », « - Bleu », « / M »,
     « – 3XL ») pour matcher le nom de base du produit importé. */
  const baseName = (name) => {
    let n = norm(name);
    // coupe tout ce qui suit le premier séparateur de variante
    n = n.split(/\s*[-–—/|]\s*/)[0];
    // retire une taille/couleur résiduelle en fin
    n = n.replace(/\b(xs|s|m|l|x{1,3}l|[2-6]\s?xl|noir|blanc|rouge|vert|bleu|rose|jaune|gris|beige|marron|orange|violet)\b\s*$/i, '');
    return n.trim();
  };

  /* Cherche le produit Chic correspondant. requireChicId=false permet de
     détecter un produit importé SANS identifiant (ancien import) pour donner
     un message précis (« réimportez-le »). */
  function findChicProduct(order, requireChicId = true) {
    const prods = loadProducts().filter(p => p.source === 'chic-affiliate' && (!requireChicId || p.chicId));
    const names = [order.product?.name, ...(order.products || []).map(p => p.name)].filter(Boolean);
    for (const name of names) {
      const full = norm(name);
      const base = baseName(name);
      const hit = prods.find(p => norm(p.name) === full)
        || prods.find(p => norm(p.name) === base)
        || prods.find(p => { const pn = norm(p.name); return pn.includes(base) || base.includes(pn); })
        || prods.find(p => { const pn = baseName(p.name); return pn && (pn === base || pn.includes(base) || base.includes(pn)); });
      if (hit) return hit;
    }
    return null;
  }

  /* Ouvre le formulaire Chic pré-rempli. Si le produit n'est pas importé, on
     le signale (il faut d'abord l'importer dans l'onglet Produits). */
  function openSend(order) {
    setResult(null);
    const chicProduct = findChicProduct(order);
    if (!chicProduct) {
      /* Importé mais sans chicId (ancien import) ? -> demander la réimportation. */
      const noId = findChicProduct(order, false);
      const msg = noId
        ? `« ${noId.name} » est importé mais sans identifiant Chic (ancien import). Supprimez-le du Stock et réimportez-le depuis l'onglet Produits.`
        : `Produit Chic introuvable pour « ${order.product?.name || order.id} » — importez-le d'abord dans l'onglet Produits.`;
      setResult({ id: order.id, ok: false, msg });
      return;
    }
    setSendModal({ order, chicProduct });
  }

  function onSent(orderId, extra = {}) {
    setOrders?.(prev => prev.map(o => o.id === orderId
      ? { ...o, status: 'chic_envoye', chicFrais: extra.fraisLivraison ?? o.chicFrais, price: extra.price ?? o.price, dateUpdated: new Date().toLocaleString('fr-MA'), manuallyModified: true }
      : o));
    setSendModal(null);
    setResult({ id: orderId, ok: true, msg: `Commande ${orderId} envoyée à Chic Affiliate ✅` });
  }

  return (
    <div className="space-y-4">
      {result && (
        <div className={`text-sm p-3 rounded-lg ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {result.ok ? <CheckCircle2 size={14} className="inline mr-1" /> : <AlertCircle size={14} className="inline mr-1" />}
          {result.msg}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="px-3 py-2">N°</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Téléphone</th>
              <th className="px-3 py-2">Ville</th>
              <th className="px-3 py-2">Produit</th>
              <th className="px-3 py-2">Taille</th>
              <th className="px-3 py-2">Prix</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {siteOrders.map(o => (
              <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{o.id}</td>
                <td className="px-3 py-2">{o.recipient?.name || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{o.recipient?.phone || '—'}</td>
                <td className="px-3 py-2">{o.recipient?.city || '—'}</td>
                <td className="px-3 py-2">{o.product?.name || '—'}</td>
                <td className="px-3 py-2">{o.product?.size || '—'}</td>
                <td className="px-3 py-2 font-semibold">{(o.price || 0).toFixed(2)} DH</td>
                <td className="px-3 py-2"><StatusSelect o={o} /></td>
                <td className="px-3 py-2"><ActionButtons o={o} /></td>
              </tr>
            ))}
            {!siteOrders.length && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Aucune commande du site sur des produits Chic</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {siteOrders.map(o => (
          <div key={o.id} className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-gray-500">{o.id}</span>
              <StatusSelect o={o} />
            </div>
            <div className="font-medium text-sm text-gray-800">{o.recipient?.name || '—'}</div>
            <div className="text-xs text-gray-600 flex flex-wrap gap-x-3">
              <span>{o.recipient?.phone}</span>
              <span>{o.recipient?.city}</span>
              <span>{o.product?.name} {o.product?.size ? `/ ${o.product.size}` : ''}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">{(o.price || 0).toFixed(2)} DH</span>
              <ActionButtons o={o} />
            </div>
          </div>
        ))}
        {!siteOrders.length && <p className="text-center py-8 text-gray-400 text-sm">Aucune commande du site sur des produits Chic</p>}
      </div>

      {sendModal && <SendToChicModal order={sendModal.order} chicProduct={sendModal.chicProduct} onClose={() => setSendModal(null)} onSent={onSent} />}
      {editOrder && <SiteOrderEditModal order={editOrder} onClose={() => setEditOrder(null)} onSave={saveEdit} />}
      {historyOrder && <HistoryModal order={historyOrder} onClose={() => setHistoryOrder(null)} />}
    </div>
  );
}

/* ── Send Order to Chic ── */
function SendOrderTab() {
  const [chicProducts, setChicProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [form, setForm] = useState({
    size: '', color: '', quantity: '1', recipientPrice: '',
    recipient: '', phone: '', villeId: '', fraisLivraison: '',
    address: '', comment: '',
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const prods = JSON.parse(localStorage.getItem('victoury_products') || '[]');
    setChicProducts(prods.filter(p => p.source === 'chic-affiliate' && p.chicId));
  }, []);

  async function loadProductDetails(chicId) {
    if (!chicId) { setDetails(null); return; }
    setLoadingDetails(true);
    try {
      const d = await fetchChicProductDetails(chicId);
      setDetails(d);
      setForm(f => ({ ...f, size: d.sizes?.[0] || '', color: d.colors?.[0]?.id || '' }));
    } catch (e) {
      setDetails(null);
      alert('Erreur: ' + e.message);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!details?.token) { alert('Chargez d\'abord un produit'); return; }
    if (!form.recipient || !form.phone || !form.villeId || !form.address) {
      alert('Remplissez tous les champs obligatoires'); return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await createChicOrder({
        token: details.token,
        productId: details.productId,
        ...form,
      });
      setResult({ ok: true, msg: 'Commande envoyée avec succès à Chic Affiliate!' });
      setForm(f => ({ ...f, recipient: '', phone: '', address: '', comment: '' }));
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Produit Chic *</label>
        <select
          value={selectedProduct}
          onChange={e => { setSelectedProduct(e.target.value); loadProductDetails(e.target.value); }}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">— Sélectionnez un produit importé —</option>
          {chicProducts.map(p => (
            <option key={p.chicId} value={p.chicId}>{p.name} ({p.salePrice} Dhs)</option>
          ))}
        </select>
        {chicProducts.length === 0 && (
          <p className="text-xs text-orange-600 mt-1">Aucun produit Chic importé. Importez d'abord depuis l'onglet Produits.</p>
        )}
      </div>

      {loadingDetails && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> Chargement des options...</div>}

      {details && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {details.sizes?.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Taille</label>
                <div className="flex gap-1 flex-wrap">
                  {details.sizes.map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, size: s }))}
                      className={`px-3 py-1 text-xs rounded-lg border ${form.size === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}
            {details.colors?.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Couleur</label>
                <div className="flex gap-1 flex-wrap">
                  {details.colors.map(c => (
                    <button key={c.id} type="button" onClick={() => setForm(f => ({ ...f, color: c.id }))}
                      className={`px-3 py-1 text-xs rounded-lg border ${form.color === c.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                    >{c.label || `#${c.id}`}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Quantité *</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Prix de Vente</label>
              <input type="text" value={form.recipientPrice} onChange={e => setForm(f => ({ ...f, recipientPrice: e.target.value }))}
                placeholder={chicProducts.find(p => p.chicId === selectedProduct)?.salePrice?.toString() || ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 border-t pt-3">Informations client</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nom du client *</label>
              <input type="text" value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone *</label>
              <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 border-t pt-3">Livraison</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ville *</label>
              <select value={form.villeId} onChange={e => setForm(f => ({ ...f, villeId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">— Sélectionnez —</option>
                {(details.cities || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Frais de livraison</label>
              <input type="text" value={form.fraisLivraison} onChange={e => setForm(f => ({ ...f, fraisLivraison: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Adresse de livraison *</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Commentaire</label>
            <textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <button type="submit" disabled={sending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Envoyer à Chic Affiliate
          </button>

          {result && (
            <div className={`text-sm p-3 rounded-lg ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {result.ok ? <CheckCircle2 size={14} className="inline mr-1" /> : <AlertCircle size={14} className="inline mr-1" />}
              {result.msg}
            </div>
          )}
        </form>
      )}
    </div>
  );
}

/* ── Factures Chic Affiliate ──
   Regroupe les commandes Livrées/Facturées, calcule ventes/revendeur/bénéfice,
   permet de marquer « Facturée » et d'imprimer — comme les Factures Victoury. */
function ChicFacturesTab({ orders = [], setOrders }) {
  const list = orders.filter(o => o.status === 'chic_livre' || o.status === 'chic_facture');
  const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

  const rows = React.useMemo(() => {
    const prods = loadProducts().filter(p => p.source === 'chic-affiliate');
    const base = (name) => norm(name).split(/\s*[-–—/|]\s*/)[0].trim();
    return list.map(o => {
      const b = base(o.product?.name);
      const prod = prods.find(p => norm(p.name) === b || base(p.name) === b || norm(p.name).includes(b));
      const qty = o.product?.qty || 1;
      const vente = o.price || 0;
      const revendeur = (prod?.purchasePrice || 0) * qty;
      const frais = o.chicFrais || 0;
      return { o, qty, vente, revendeur, frais, benefice: vente - revendeur - frais, prodName: prod?.name || o.product?.name || '—' };
    });
  }, [list]);

  const totals = rows.reduce((a, r) => ({
    ventes: a.ventes + r.vente, revendeur: a.revendeur + r.revendeur, frais: a.frais + r.frais, benefice: a.benefice + r.benefice,
  }), { ventes: 0, revendeur: 0, frais: 0, benefice: 0 });

  function facturer(id) {
    setOrders?.(prev => prev.map(o => o.id === id ? { ...o, status: 'chic_facture', manuallyModified: true } : o));
  }
  function setStatus(id, status) {
    setOrders?.(prev => prev.map(o => o.id === id ? { ...o, status, dateUpdated: new Date().toLocaleString('fr-MA'), manuallyModified: true } : o));
  }
  function facturerTout() {
    const ids = new Set(rows.filter(r => r.o.status === 'chic_livre').map(r => r.o.id));
    if (!ids.size) return;
    setOrders?.(prev => prev.map(o => ids.has(o.id) ? { ...o, status: 'chic_facture', manuallyModified: true } : o));
  }
  function imprimer() {
    const w = window.open('', '_blank');
    if (!w) return;
    const rowsHtml = rows.map(r => `<tr>
      <td>${r.o.id}</td><td>${r.o.recipient?.name || '—'}</td><td>${r.prodName}</td>
      <td>${r.o.product?.size || '—'}</td><td>${r.qty}</td>
      <td style="text-align:right">${r.vente.toFixed(2)}</td>
      <td style="text-align:right">${r.revendeur.toFixed(2)}</td>
      <td style="text-align:right">${r.frais.toFixed(2)}</td>
      <td style="text-align:right;font-weight:bold">${r.benefice.toFixed(2)}</td></tr>`).join('');
    w.document.write(`<html><head><title>Facture Chic Affiliate</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}
      tfoot td{font-weight:bold;background:#f9fafb}</style></head><body>
      <h1>Facture — Chic Affiliate</h1>
      <p>Date : ${new Date().toLocaleDateString('fr-MA')} · ${rows.length} commande(s)</p>
      <table><thead><tr><th>N°</th><th>Client</th><th>Produit</th><th>Taille</th><th>Qté</th>
      <th>Vente (DH)</th><th>Revendeur (DH)</th><th>Frais (DH)</th><th>Bénéfice (DH)</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td colspan="5">TOTAL</td>
      <td style="text-align:right">${totals.ventes.toFixed(2)}</td>
      <td style="text-align:right">${totals.revendeur.toFixed(2)}</td>
      <td style="text-align:right">${totals.frais.toFixed(2)}</td>
      <td style="text-align:right">${totals.benefice.toFixed(2)}</td></tr></tfoot></table>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100"><p className="text-xs text-gray-500">Commandes</p><p className="text-lg font-bold text-gray-900">{rows.length}</p></div>
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100"><p className="text-xs text-blue-600">Ventes</p><p className="text-lg font-bold text-blue-700">{totals.ventes.toFixed(2)} DH</p></div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100"><p className="text-xs text-amber-600">Prix revendeur</p><p className="text-lg font-bold text-amber-700">{totals.revendeur.toFixed(2)} DH</p></div>
        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100"><p className="text-xs text-rose-600">Frais livraison</p><p className="text-lg font-bold text-rose-700">{totals.frais.toFixed(2)} DH</p></div>
        <div className="bg-green-50 rounded-xl p-3 border border-green-100"><p className="text-xs text-green-600">Bénéfice net</p><p className="text-lg font-bold text-green-700">{totals.benefice.toFixed(2)} DH</p></div>
      </div>

      <div className="flex gap-2 justify-end">
        {rows.some(r => r.o.status === 'chic_livre') && (
          <button onClick={facturerTout} className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-900">
            <Check size={14} /> Tout facturer
          </button>
        )}
        {rows.length > 0 && (
          <button onClick={imprimer} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            🖨️ Imprimer
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
              <th className="px-3 py-2">N°</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">Ville</th><th className="px-3 py-2">Produit</th>
              <th className="px-3 py-2">Taille</th><th className="px-3 py-2">Vente</th><th className="px-3 py-2">Revendeur</th>
              <th className="px-3 py-2">Frais</th><th className="px-3 py-2">Bénéfice</th><th className="px-3 py-2">Statut</th><th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.o.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{r.o.id}</td>
                <td className="px-3 py-2">{r.o.recipient?.name || '—'}</td>
                <td className="px-3 py-2">{r.o.recipient?.city || '—'}</td>
                <td className="px-3 py-2">{r.prodName}</td>
                <td className="px-3 py-2">{r.o.product?.size || '—'}</td>
                <td className="px-3 py-2 font-semibold">{r.vente.toFixed(2)}</td>
                <td className="px-3 py-2 text-amber-700">{r.revendeur.toFixed(2)}</td>
                <td className="px-3 py-2 text-rose-700">{r.frais.toFixed(2)}</td>
                <td className="px-3 py-2 text-green-700 font-semibold">{r.benefice.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <select
                    value={r.o.status}
                    onChange={e => setStatus(r.o.id, e.target.value)}
                    className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer ${chicStatusMeta(r.o.status).cls}`}
                  >
                    {CHIC_ORDER_STATUSES.map(s => <option key={s.key} value={s.key} className="bg-white text-gray-800">{s.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {r.o.status === 'chic_livre' && (
                      <button onClick={() => facturer(r.o.id)} title="Facturer" className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-900"><Check size={12} /> Facturer</button>
                    )}
                    <button onClick={() => setStatus(r.o.id, 'chic_envoye')} title="Renvoyer vers Commandes Site" className="p-1.5 rounded bg-purple-100 text-purple-600 hover:bg-purple-200 transition"><RefreshCw size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">Aucune commande livrée. Passez une commande à « Livrée » dans Commandes Site.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Villes & Frais ──
   Charge la liste des villes depuis une fiche produit Chic et permet de saisir
   le frais de livraison par ville (mémorisé, réutilisé partout à l'envoi). */
function ChicCitiesTab() {
  const [cities, setCities] = useState([]);
  const [map, setMap] = useState(getCityFraisMap());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  async function loadCities() {
    setLoading(true); setError(null);
    try {
      const prod = loadProducts().find(p => p.source === 'chic-affiliate' && p.chicId);
      if (!prod) throw new Error('Importez d\'abord un produit Chic (les villes proviennent d\'une fiche produit).');
      const d = await fetchChicProductDetails(prod.chicId);
      setCities(d.cities || []);
      if (!d.cities?.length) setError('Aucune ville trouvée sur la fiche produit.');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { loadCities(); }, []);

  function onFrais(name, val) {
    setCityFraisValue(name, val);
    setMap(getCityFraisMap());
  }

  const filtered = cities.filter(c => !search || (c.name || '').toLowerCase().includes(search.toLowerCase()));
  const filledCount = cities.filter(c => map[cityKey(c.name)] != null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une ville..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <button onClick={loadCities} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Charger les villes
        </button>
      </div>

      {cities.length > 0 && (
        <p className="text-xs text-gray-500">{filledCount}/{cities.length} ville(s) avec un frais défini. Le frais saisi ici est réutilisé automatiquement à l'envoi.</p>
      )}
      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg"><AlertCircle size={14} className="inline mr-1" />{error}</div>}

      {loading ? (
        <div className="flex flex-col gap-2 py-4 animate-pulse">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 w-full bg-gray-200 rounded-lg" />)}</div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase bg-gray-50">
                <th className="px-4 py-2">Ville</th>
                <th className="px-4 py-2 w-40">Frais de livraison (DH)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={map[cityKey(c.name)] ?? ''}
                      onChange={e => onFrais(c.name, e.target.value)}
                      placeholder="—"
                      className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={2} className="text-center py-8 text-gray-400">{cities.length ? 'Aucune ville ne correspond.' : 'Cliquez sur « Charger les villes ».'}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function ChicAffiliatePage({ orders = [], setOrders, onDeleteOrder }) {
  const [tab, setTab] = useState('products');
  const [sessionExpired, setSessionExpired] = useState(false);
  const siteCount = orders.filter(o => o.status === 'chic_nouveau').length;
  const factureCount = orders.filter(o => o.status === 'chic_livre').length;

  useEffect(() => {
    const onExpired = () => setSessionExpired(true);
    window.addEventListener('chic-session-expired', onExpired);
    return () => window.removeEventListener('chic-session-expired', onExpired);
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Store size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chic Affiliate</h1>
          <p className="text-xs text-gray-500">Gestion des produits et commandes chic-affiliate.com</p>
        </div>
      </div>

      {/* Bannière de reconnexion (cookies Chic expirés) */}
      {sessionExpired && (
        <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-red-700">Session Chic Affiliate expirée</p>
            <p className="text-red-600 mt-0.5 text-xs leading-relaxed">
              Les cookies de connexion ont expiré. Ouvrez <b>chic-affiliate.com</b> (connecté) →
              F12 → Application → Cookies → recopiez <b>XSRF-TOKEN</b> et <b>laravel_session</b>
              dans « Configuration Chic Affiliate » ci-dessous, puis « Tester la connexion ».
            </p>
          </div>
          <button onClick={() => setSessionExpired(false)} className="text-red-400 hover:text-red-600 text-xs font-medium shrink-0">Masquer</button>
        </div>
      )}

      {/* Config */}
      <ConfigPanel onTest={(ok) => { if (ok) setSessionExpired(false); }} />

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('products')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'products' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Package size={14} /> Produits
        </button>
        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'orders' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <ShoppingCart size={14} /> Commandes
        </button>
        <button
          onClick={() => setTab('site')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'site' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <ShoppingCart size={14} /> Commandes Site
          {siteCount > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">{siteCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('factures')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'factures' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Package size={14} /> Factures
          {factureCount > 0 && (
            <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{factureCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('villes')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'villes' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          📍 Villes & Frais
        </button>
        <button
          onClick={() => setTab('send')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition ${tab === 'send' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
        >
          <Send size={14} /> Envoyer
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {tab === 'products' ? <ProductsTab />
          : tab === 'orders' ? <OrdersTab victouryOrders={orders} setVictouryOrders={setOrders} />
          : tab === 'site' ? <SiteOrdersTab orders={orders} setOrders={setOrders} onDeleteOrder={onDeleteOrder} />
          : tab === 'factures' ? <ChicFacturesTab orders={orders} setOrders={setOrders} />
          : tab === 'villes' ? <ChicCitiesTab />
          : <SendOrderTab />}
      </div>
    </div>
  );
}
